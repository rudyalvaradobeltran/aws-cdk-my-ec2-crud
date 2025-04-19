import { Stack, StackProps } from "aws-cdk-lib";
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

interface WebappEc2StackProps extends StackProps {
  vpc: Vpc;
}

export class WebappEc2Stack extends Stack {
  constructor(scope: Construct, id: string, props: WebappEc2StackProps) {
    super(scope, id, props);

    const { vpc } = props;

    const securityGroup = new SecurityGroup(this, "PublicInstanceSG", {
      vpc,
      description: "Allow HTTPS access",
      allowAllOutbound: true,
    });

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
          'arn:aws:s3:::temp-webapp-deployment-*',
          'arn:aws:s3:::temp-webapp-deployment-*/*',
        ],
      })
    );    

    const machineImage = new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
    });

    const instance = new Instance(this, "WebappInstance", {
      vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
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
