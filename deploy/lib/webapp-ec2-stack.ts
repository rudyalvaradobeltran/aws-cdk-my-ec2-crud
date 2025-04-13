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
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";

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

    const ssmRole = new Role(this, 'SSMRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const machineImage = new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
    });

    new Instance(this, "WebappInstance", {
      vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: machineImage,
      securityGroup,
      vpcSubnets: { subnets: [publicSubnet] },
      role: ssmRole
    });
  }
}
