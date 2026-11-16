import * as pulumi from "@pulumi/pulumi";
import * as ps from "@pulumi/pulumiservice";

const org = pulumi.getOrganization();

// Least privilege: the agent can read stacks, their update logs and state, and search resources.
// It cannot deploy and it cannot approve. Widening this takes a pull request.
const role = new ps.OrganizationRole("loop-troubleshooter-role", {
    organizationName: org,
    name: "loop-deploy-troubleshooter",
    description: "Read stacks, their history and state, and search resources. No deploy, no approve.",
    permissions: ps.buildRolePermissionsOutput({
        organizationScopes: ["resources:search"],
        stackRules: [{ all: true, scopes: ["stack:read", "stack:export"] }],
    }).permissions,
});

const agent = new ps.api.agents.Definition("deploy-troubleshooter", {
    orgName: org,
    name: "loop-deploy-troubleshooter",
    displayName: "Deploy Troubleshooter",
    purpose: "When a loop-app update fails, find the root cause and propose the fix as a pull request",
    customInstructions: [
        "You are started when an update to a loop-app stack fails.",
        "Read the failed update's log and the stack's recent history, then read the Pulumi program in app/ of pulumi-pequod/loop-demo.",
        "Find the root cause: the exact line of code and why the cloud provider rejected it.",
        "Open ONE pull request against main with the smallest change that fixes it.",
        "In the pull request description, give the evidence: the stack, the update number, the error message, and the cause.",
        "Never deploy, never run pulumi up, and never approve anything. The fix ships through the loop delivery pipeline after a person merges it.",
    ].join("\n"),
    roleId: role.roleId,
});

// Any failed update on a loop-app stack starts a task.
// Name the stacks: the pipeline's own stack records failed updates of its own, and those must not trigger it.
const STACKS = ["dev", "staging", "prod-us", "prod-eu"];
new ps.api.AgentAutomationV2("failed-update", {
    orgName: org,
    kind: "triggered",
    name: "loop-app update failed",
    trigger: {
        type: "stack_operation",
        quietPeriodSeconds: 60,
        operations: ["update"],
        results: ["failed"],
        stacks: STACKS.map(name => ({ name, routingProject: "loop-app" })),
    },
    task: {
        message: {
            type: "user_message",
            content: "A loop-app update failed. Find the root cause and open a pull request with the fix.",
        },
        approvalMode: "auto",
        agentDefinitionId: agent.definitionID,
    },
});

export const agentId = agent.definitionID;
