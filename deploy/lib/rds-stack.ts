import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Vpc,
  Peer,
  Port,
  InstanceType,
  InstanceClass,
  InstanceSize,
  ISecurityGroup,
  SecurityGroup,
  SubnetType
} from "aws-cdk-lib/aws-ec2";
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion } from "aws-cdk-lib/aws-rds";
import { SecretValue } from "aws-cdk-lib";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

interface RdsStackProps extends StackProps {
  VPC: Vpc;
}

export class RdsStack extends Stack {
  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    const { VPC } = props;

    // Security Group for Database
    const dbSecurityGroup = new SecurityGroup(this, 'RDSSecurityGroup', {
      vpc: VPC,
      description: 'Security group for RDS PostgreSQL instance',
      allowAllOutbound: false,
    });

    // Remove this for production or use a bastion host
    dbSecurityGroup.addIngressRule(
      Peer.ipv4(`${process.env.MY_IP_ADDRESS}/32`),
      Port.tcp(5432),
      'Allow PostgreSQL access from development machine'
    );

    const privateSubnets = VPC.selectSubnets({
      subnetGroupName: 'PrivateSubnet',
    }).subnets;

    // Create database credentials secret
    const dbCredentials = new Secret(this, 'RDSDBCredentials', {
      description: 'Credentials for PostgreSQL database',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        passwordLength: 16,
      },
    });

    const databaseInstance = new DatabaseInstance(this, "Database", {
      vpc: VPC,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED
      },
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_15
      }),
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      allocatedStorage: 20,
      securityGroups: [dbSecurityGroup],
      credentials: Credentials.fromSecret(dbCredentials),
      removalPolicy: RemovalPolicy.DESTROY,
      deletionProtection: false,
      databaseName: "myapp",
      port: 5432
    });

    new CfnOutput(this, "DatabaseEndpoint", {
      value: databaseInstance.instanceEndpoint.hostname,
      description: "Database endpoint"
    });
  }
}
