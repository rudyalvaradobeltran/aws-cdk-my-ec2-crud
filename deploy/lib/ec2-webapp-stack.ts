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

interface Ec2WebappStackProps extends StackProps {
  VPC: Vpc;
}

export class Ec2WebappStack extends Stack {
  constructor(scope: Construct, id: string, props: Ec2WebappStackProps) {
    super(scope, id, props);

    const { VPC } = props;

    const webappDeployLogs = new LogGroup(this, 'WebappDeployLogs', {
      logGroupName: 'webapp-deploy-logs',
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const publicInstanceSG = new SecurityGroup(this, "PublicInstanceSG", {
      vpc: VPC,
      description: "Allow public access",
      allowAllOutbound: true,
    });

    publicInstanceSG.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "Allow HTTP");
    publicInstanceSG.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "Allow HTTPS");
    publicInstanceSG.addEgressRule(Peer.anyIpv4(), Port.allTraffic(), "Allow All Egress");

    const publicSubnet = VPC.selectSubnets({
      subnetGroupName: 'PublicSubnet',
    }).subnets[0];

    const Ec2WebappRole = new Role(this, 'Ec2WebappRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });
    
    Ec2WebappRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );
    
    Ec2WebappRole.addToPolicy(
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

    Ec2WebappRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams'
        ],
        resources: [webappDeployLogs.logGroupArn],
      })
    );

    const machineImage = new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
    });

    const webappInstance = new Instance(this, "WebappInstance", {
      vpc: VPC,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: machineImage,
      securityGroup: publicInstanceSG,
      vpcSubnets: { subnets: [publicSubnet] },
      role: Ec2WebappRole
    });

    new StringParameter(this, 'WebappInstanceId', {
      parameterName: '/webapp/ec2-webapp-instance-id',
      stringValue: webappInstance.instanceId,
    });
  }
}
