import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from "aws-cdk-lib";
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
  AmazonLinuxGeneration,
  SubnetType
} from "aws-cdk-lib/aws-ec2";
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  TargetType,
  ListenerAction,
  IpAddressType
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { InstanceTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets/lib";

interface Ec2ApiStackProps extends StackProps {
  VPC: Vpc;
}

export class Ec2ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: Ec2ApiStackProps) {
    super(scope, id, props);

    const { VPC } = props;

    const apiDeployLogs = new LogGroup(this, 'ApiDeployLogs', {
      logGroupName: 'api-deploy-logs',
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const privateInstanceSG = new SecurityGroup(this, "PrivateInstanceSG", {
      vpc: VPC,
      description: "Allow access from ALB only"
    });

    const albSG = new SecurityGroup(this, "AlbSG", {
      vpc: VPC,
      description: "Allow public access to ALB"
    });

    albSG.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "Allow HTTP from anywhere");
    albSG.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "Allow HTTPS from anywhere");
    
    privateInstanceSG.addIngressRule(albSG, Port.tcp(80), "Allow HTTP from ALB only");
    privateInstanceSG.addEgressRule(Peer.anyIpv4(), Port.allTraffic(), "Allow All Egress");

    const privateSubnet = VPC.selectSubnets({
      subnetGroupName: 'PrivateSubnet',
    }).subnets[0];

    const Ec2ApiRole = new Role(this, 'Ec2ApiRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });
    
    Ec2ApiRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );
    
    Ec2ApiRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:ListBucket',
        ],
        resources: [
          'arn:aws:s3:::temp-api-deployment',
          'arn:aws:s3:::temp-api-deployment/*',
        ],
      })
    );

    Ec2ApiRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams'
        ],
        resources: [apiDeployLogs.logGroupArn],
      })
    );

    const machineImage = new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
    });
    
    const APIInstance = new Instance(this, "APIInstance", {
      vpc: VPC,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: machineImage,
      securityGroup: privateInstanceSG,
      vpcSubnets: { subnets: [privateSubnet] },
      role: Ec2ApiRole
    });

    const alb = new ApplicationLoadBalancer(this, 'ApiALB', {
      vpc: VPC,
      internetFacing: true,
      securityGroup: albSG,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      ipAddressType: IpAddressType.IPV4
    });

    const targetGroup = new ApplicationTargetGroup(this, 'ApiTargetGroup', {
      vpc: VPC,
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      targetType: TargetType.INSTANCE,
    });

    const target = new InstanceTarget(APIInstance);
    targetGroup.addTarget(target);

    alb.addListener('HttpListener', {
      port: 80,
      defaultAction: ListenerAction.forward([targetGroup])
    });

    /* 
    const certificate = Certificate.fromCertificateArn(this, 'Certificate', 'your-certificate-arn');
    const httpsListener = alb.addListener('HttpsListener', {
      port: 443,
      certificates: [certificate],
      defaultAction: ListenerAction.forward([targetGroup])
    });
    */

    new StringParameter(this, 'APIInstanceId', {
      parameterName: '/api/ec2-api-instance-id',
      stringValue: APIInstance.instanceId,
    });

    new CfnOutput(this, 'ApiEndpoint', {
      description: 'The DNS name of the ALB',
      value: alb.loadBalancerDnsName
    });
  }
}