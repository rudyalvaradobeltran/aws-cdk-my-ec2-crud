import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Vpc,
  Peer,
  Port,
  InstanceType,
  InstanceClass,
  InstanceSize,
  ISecurityGroup
} from "aws-cdk-lib/aws-ec2";
import { DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion } from "aws-cdk-lib/aws-rds";
import { SecretValue } from "aws-cdk-lib";

interface RdsStackProps extends StackProps {
  VPC: Vpc;
  securityGroup: ISecurityGroup;
}

export class RdsStack extends Stack {
  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    const { VPC, securityGroup } = props;

    securityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(5432),
      "Allow PostgreSQL access from API instance"
    );

    const privateSubnets = VPC.selectSubnets({
      subnetGroupName: 'PrivateSubnet',
    }).subnets;

    const database = new DatabaseInstance(this, "Database", {
      vpc: VPC,
      vpcSubnets: {
        subnets: privateSubnets
      },
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_15
      }),
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      securityGroups: [securityGroup],
      credentials: {
        username: 'postgres',
        password: SecretValue.unsafePlainText('postgres')
      },
      backupRetention: Duration.days(7),
      preferredBackupWindow: "03:00-04:00",
      preferredMaintenanceWindow: "Mon:04:00-Mon:05:00",
      removalPolicy: RemovalPolicy.DESTROY,
      deletionProtection: false,
      databaseName: "myapp"
    });

    new CfnOutput(this, "DatabaseEndpoint", {
      value: database.instanceEndpoint.hostname,
      description: "Database endpoint"
    });
  }
}
