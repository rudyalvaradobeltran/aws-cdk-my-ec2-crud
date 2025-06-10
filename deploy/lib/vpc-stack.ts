import { Stack, StackProps } from "aws-cdk-lib";
import {
  Vpc,
  IpAddresses,
  SubnetType,
  NetworkAcl,
  AclCidr,
  AclTraffic,
  TrafficDirection,
  Action
} from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class VpcStack extends Stack {
  public readonly VPC: Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const VPC = new Vpc(this, "VPC", {
      vpcName: "VPC",
      ipAddresses: IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'database',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    const NACL = new NetworkAcl(this, 'NACL', {
      vpc: VPC,
      subnetSelection: { subnetType: SubnetType.PUBLIC },
    });

    NACL.addEntry('AllowHTTP', {
      ruleNumber: 100,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(80),
      direction: TrafficDirection.INGRESS,
      ruleAction: Action.ALLOW,
    });

    NACL.addEntry('AllowHTTPS', {
      ruleNumber: 110,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(443),
      direction: TrafficDirection.INGRESS,
      ruleAction: Action.ALLOW,
    });

    NACL.addEntry('AllowEphemeralInbound', {
      ruleNumber: 150,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPortRange(1024, 65535),
      direction: TrafficDirection.INGRESS,
      ruleAction: Action.ALLOW,
    });

    NACL.addEntry('AllowOutboundHTTP', {
      ruleNumber: 100,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(80),
      direction: TrafficDirection.EGRESS,
      ruleAction: Action.ALLOW,
    });

    NACL.addEntry('AllowOutboundHTTPS', {
      ruleNumber: 110,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(443),
      direction: TrafficDirection.EGRESS,
      ruleAction: Action.ALLOW,
    });
    
    NACL.addEntry('AllowOutboundEphemeral', {
      ruleNumber: 150,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPortRange(1024, 65535),
      direction: TrafficDirection.EGRESS,
      ruleAction: Action.ALLOW,
    });

    this.VPC = VPC;
  }
}
