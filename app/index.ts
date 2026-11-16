import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const env = pulumi.getStack(); // dev | staging | prod-us | prod-eu
const name = `loop-api-${env}`;

// Staging and prod get more memory (and with it more CPU) and warm, provisioned instances.
// Dev keeps the Lambda defaults.
const perf: Record<string, { memorySize: number; provisionedConcurrency: number }> = {
    "staging": { memorySize: 512, provisionedConcurrency: 1 },
    "prod-us": { memorySize: 512, provisionedConcurrency: 1 },
    "prod-eu": { memorySize: 512, provisionedConcurrency: 1 },
};
const tuning = perf[env];

const role = new aws.iam.Role(`${name}-role`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
});
new aws.iam.RolePolicyAttachment(`${name}-logs`, {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

const logs = new aws.cloudwatch.LogGroup(`${name}-logs`, {
    name: `/aws/lambda/${name}`,
    retentionInDays: 14,
});

const fn = new aws.lambda.Function(name, {
    name,
    runtime: aws.lambda.Runtime.NodeJS22dX,
    handler: "index.handler",
    role: role.arn,
    code: new pulumi.asset.AssetArchive({
        "index.mjs": new pulumi.asset.StringAsset(
            `export const handler = async () => ({ statusCode: 200, body: JSON.stringify({ ok: true, env: "${env}" }) });`,
        ),
    }),
    ...(tuning ? { memorySize: tuning.memorySize } : {}),
    // Provisioned concurrency needs a published version; unpublished functions report "$LATEST".
    publish: !!tuning,
}, { dependsOn: [logs] });

if (tuning) {
    new aws.lambda.ProvisionedConcurrencyConfig(`${name}-warm`, {
        functionName: fn.name,
        qualifier: fn.version,
        provisionedConcurrentExecutions: tuning.provisionedConcurrency,
    });
}

const url = new aws.lambda.FunctionUrl(`${name}-url`, {
    functionName: fn.name,
    authorizationType: "NONE",
});

export const endpoint = url.functionUrl;
