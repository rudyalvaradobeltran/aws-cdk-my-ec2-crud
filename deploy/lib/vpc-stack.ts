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
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, "VPCPrimary", {
      vpcName: "VPCPrimary",
      ipAddresses: IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "PublicSubnet",
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "PrivateSubnet",
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const nacl = new NetworkAcl(this, 'PublicNACL', {
      vpc,
      subnetSelection: { subnetType: SubnetType.PUBLIC },
    });

    nacl.addEntry('AllowHTTP', {
      ruleNumber: 100,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(80),
      direction: TrafficDirection.INGRESS,
      ruleAction: Action.ALLOW,
    });

    nacl.addEntry('AllowHTTPS', {
      ruleNumber: 100,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(443),
      direction: TrafficDirection.INGRESS,
      ruleAction: Action.ALLOW,
    });

    nacl.addEntry('AllowEphemeralInbound', {
      ruleNumber: 110,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPortRange(1024, 65535),
      direction: TrafficDirection.INGRESS,
      ruleAction: Action.ALLOW,
    });

    nacl.addEntry('AllowOutboundHTTP', {
      ruleNumber: 100,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(80),
      direction: TrafficDirection.EGRESS,
      ruleAction: Action.ALLOW,
    });

    nacl.addEntry('AllowOutboundHTTPS', {
      ruleNumber: 100,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPort(443),
      direction: TrafficDirection.EGRESS,
      ruleAction: Action.ALLOW,
    });
    
    nacl.addEntry('AllowOutboundEphemeral', {
      ruleNumber: 110,
      cidr: AclCidr.anyIpv4(),
      traffic: AclTraffic.tcpPortRange(1024, 65535),
      direction: TrafficDirection.EGRESS,
      ruleAction: Action.ALLOW,
    });

    this.vpc = vpc;
  }
}
