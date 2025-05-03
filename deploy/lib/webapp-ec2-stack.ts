import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Vpc,
  SecurityGroup,
  Peer,
  Port,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  AmazonLinuxImage,
  AmazonLinuxGeneration
} from "aws-cdk-lib/aws-ec2";
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

interface WebappEc2StackProps extends StackProps {
  vpc: Vpc;
}

export class WebappEc2Stack extends Stack {
  constructor(scope: Construct, id: string, props: WebappEc2StackProps) {
    super(scope, id, props);

    const { vpc } = props;

    const logGroup = new LogGroup(this, 'WebappDeployLogs', {
      logGroupName: 'webapp-deploy-logs',
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const securityGroup = new SecurityGroup(this, "PublicInstanceSG", {
      vpc,
      description: "Allow HTTPS access",
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "Allow HTTP");
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "Allow HTTPS");
    securityGroup.addEgressRule(Peer.anyIpv4(), Port.allTraffic(), "Allow All Egress");

    const publicSubnet = vpc.selectSubnets({
      subnetGroupName: 'PublicSubnet',
    }).subnets[0];

    const ec2Role = new Role(this, 'EC2Role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });
    
    ec2Role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );
    
    ec2Role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:ListBucket',
        ],
        resources: [
          'arn:aws:s3:::temp-webapp-deployment',
          'arn:aws:s3:::temp-webapp-deployment/*',
        ],
      })
    );

    ec2Role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams'
        ],
        resources: [logGroup.logGroupArn],
      })
    );

    const machineImage = new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
    });

    const instance = new Instance(this, "WebappInstance", {
      vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.SMALL),
      machineImage: machineImage,
      securityGroup,
      vpcSubnets: { subnets: [publicSubnet] },
      role: ec2Role
    });

    new StringParameter(this, 'WebappInstanceId', {
      parameterName: '/webapp/webapp-ec2-instance-id',
      stringValue: instance.instanceId,
    });
  }
}
