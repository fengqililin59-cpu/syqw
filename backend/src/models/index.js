/**
 * @file Sequelize 模型初始化与表关联定义。
 */
import { sequelize } from '../config/database.js';
import { Tenant } from './tenant.model.js';
import { Role } from './role.model.js';
import { User } from './user.model.js';
import { Customer } from './customer.model.js';
import { CustomerFollowUp } from './customerFollowUp.model.js';
import { Tag } from './tag.model.js';
import { CustomerTag } from './customerTag.model.js';
import { WeworkChannelGroup } from './weworkChannelGroup.model.js';
import { WeworkChannel } from './weworkChannel.model.js';
import { WeworkCustomerAddRecord } from './weworkCustomerAddRecord.model.js';
import { WeworkCustomerMessage } from './weworkCustomerMessage.model.js';
import { WeworkToken } from './weworkToken.model.js';
import { AuditLog } from './auditLog.model.js';
import { AdClickRecord } from './adClickRecord.model.js';
import { Campaign } from './campaign.model.js';
import { CampaignEnrollment } from './campaignEnrollment.model.js';
import { CampaignRewardJob } from './campaignRewardJob.model.js';
import { InviteRecord } from './inviteRecord.model.js';
import { AiGenerationLog } from './aiGenerationLog.model.js';
import { AutomationRule } from './automationRule.model.js';
import { AutomationLog } from './automationLog.model.js';
import { CustomerScore } from './customerScore.model.js';
import { Flow } from './flow.model.js';
import { FlowNode } from './flowNode.model.js';
import { FlowEdge } from './flowEdge.model.js';
import { FlowRun } from './flowRun.model.js';
import { AutoMessageLog } from './autoMessageLog.model.js';
import { BroadcastTask } from './broadcastTask.model.js';
import { BroadcastTaskRecipient } from './broadcastTaskRecipient.model.js';
import { RegistrationOtpChallenge } from './registrationOtpChallenge.model.js';
import { PageVisit } from './pageVisit.model.js';
import { AdConversionEvent } from './adConversionEvent.model.js';
import { MarketingEvent } from './marketingEvent.model.js';
import { AdSpendDaily } from './adSpendDaily.model.js';
import { BackgroundJob } from './backgroundJob.model.js';
import { AggAdsRoiDaily } from './aggAdsRoiDaily.model.js';
import { AggChannelDaily } from './aggChannelDaily.model.js';
import { AggregationMeta } from './aggregationMeta.model.js';
import { IntentAlert } from './intentAlert.model.js';
import { MigrationCampaign } from './migrationCampaign.model.js';
import { MigrationRecord } from './migrationRecord.model.js';
import { CustomerTransfer } from './customerTransfer.model.js';
import { ImportJob } from './importJob.model.js';
import { Plan } from './plan.model.js';
import { Subscription } from './subscription.model.js';
import { UsageStat } from './usageStat.model.js';
import { PaymentRecord } from './paymentRecord.model.js';
import { CallRecord } from './callRecord.model.js';
import { UserCallSetting } from './userCallSetting.model.js';
import { CustomerGroup } from './customerGroup.model.js';
import { GroupMember } from './groupMember.model.js';
import { GroupSopTask } from './groupSopTask.model.js';
import { GroupSopTarget } from './groupSopTarget.model.js';
import { GroupSendLog } from './groupSendLog.model.js';
import { SmsTemplate } from './smsTemplate.model.js';
import { SmsTask } from './smsTask.model.js';
import { SmsSendLog } from './smsSendLog.model.js';
import { ScriptLibraryItem } from './scriptLibraryItem.model.js';
import { OmniChannel } from './omniChannel.model.js';
import { InboxThread } from './inboxThread.model.js';
import { InboxMessage } from './inboxMessage.model.js';
import { KbDocument } from './kbDocument.model.js';
import { KbChunk } from './kbChunk.model.js';
import { AiReplyLog } from './aiReplyLog.model.js';
import { InboxFollowupTask } from './inboxFollowupTask.model.js';
import { CustomerOrder } from './customerOrder.model.js';
import { ServiceTicket } from './serviceTicket.model.js';
import { TenantLeadSetting } from './tenantLeadSetting.model.js';
import { TenantPublicWebhookSetting } from './tenantPublicWebhookSetting.model.js';

Tenant.initModel(sequelize);
Role.initModel(sequelize);
User.initModel(sequelize);
Customer.initModel(sequelize);
CustomerFollowUp.initModel(sequelize);
Tag.initModel(sequelize);
CustomerTag.initModel(sequelize);
WeworkChannelGroup.initModel(sequelize);
WeworkChannel.initModel(sequelize);
WeworkCustomerAddRecord.initModel(sequelize);
WeworkCustomerMessage.initModel(sequelize);
WeworkToken.initModel(sequelize);
AuditLog.initModel(sequelize);
AdClickRecord.initModel(sequelize);
Campaign.initModel(sequelize);
CampaignEnrollment.initModel(sequelize);
CampaignRewardJob.initModel(sequelize);
InviteRecord.initModel(sequelize);
AiGenerationLog.initModel(sequelize);
AutomationRule.initModel(sequelize);
AutomationLog.initModel(sequelize);
CustomerScore.initModel(sequelize);
Flow.initModel(sequelize);
FlowNode.initModel(sequelize);
FlowEdge.initModel(sequelize);
FlowRun.initModel(sequelize);
AutoMessageLog.initModel(sequelize);
BroadcastTask.initModel(sequelize);
BroadcastTaskRecipient.initModel(sequelize);
RegistrationOtpChallenge.initModel(sequelize);
PageVisit.initModel(sequelize);
AdConversionEvent.initModel(sequelize);
MarketingEvent.initModel(sequelize);
AdSpendDaily.initModel(sequelize);
BackgroundJob.initModel(sequelize);
AggAdsRoiDaily.initModel(sequelize);
AggChannelDaily.initModel(sequelize);
AggregationMeta.initModel(sequelize);
IntentAlert.initModel(sequelize);
MigrationCampaign.initModel(sequelize);
MigrationRecord.initModel(sequelize);
CustomerTransfer.initModel(sequelize);
ImportJob.initModel(sequelize);
Plan.initModel(sequelize);
Subscription.initModel(sequelize);
UsageStat.initModel(sequelize);
PaymentRecord.initModel(sequelize);
CallRecord.initModel(sequelize);
UserCallSetting.initModel(sequelize);
CustomerGroup.initModel(sequelize);
GroupMember.initModel(sequelize);
GroupSopTask.initModel(sequelize);
GroupSopTarget.initModel(sequelize);
GroupSendLog.initModel(sequelize);
SmsTemplate.initModel(sequelize);
SmsTask.initModel(sequelize);
SmsSendLog.initModel(sequelize);
ScriptLibraryItem.initModel(sequelize);
OmniChannel.initModel(sequelize);
InboxThread.initModel(sequelize);
InboxMessage.initModel(sequelize);
KbDocument.initModel(sequelize);
KbChunk.initModel(sequelize);
AiReplyLog.initModel(sequelize);
InboxFollowupTask.initModel(sequelize);
CustomerOrder.initModel(sequelize);
ServiceTicket.initModel(sequelize);
TenantLeadSetting.initModel(sequelize);
TenantPublicWebhookSetting.initModel(sequelize);

Tenant.hasMany(Role, { foreignKey: 'tenant_id' });
Role.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(User, { foreignKey: 'tenant_id' });
User.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasOne(TenantLeadSetting, { foreignKey: 'tenant_id' });
TenantLeadSetting.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasOne(TenantPublicWebhookSetting, { foreignKey: 'tenant_id' });
TenantPublicWebhookSetting.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(User, { foreignKey: 'role_id' });

Tenant.hasMany(Customer, { foreignKey: 'tenant_id' });
Customer.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(Customer, { foreignKey: 'owner_id', as: 'owned_customers' });
Customer.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

Tenant.hasMany(WeworkCustomerMessage, { foreignKey: 'tenant_id' });
WeworkCustomerMessage.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.hasMany(WeworkCustomerMessage, { foreignKey: 'customer_id' });
WeworkCustomerMessage.belongsTo(Customer, { foreignKey: 'customer_id' });

Customer.hasMany(CustomerFollowUp, { foreignKey: 'customer_id' });
CustomerFollowUp.belongsTo(Customer, { foreignKey: 'customer_id' });
User.hasMany(CustomerFollowUp, { foreignKey: 'user_id', as: 'authored_follow_ups' });
CustomerFollowUp.belongsTo(User, { foreignKey: 'user_id', as: 'author' });

Tenant.hasMany(Tag, { foreignKey: 'tenant_id' });
Tag.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Customer.belongsToMany(Tag, {
  through: CustomerTag,
  foreignKey: 'customer_id',
  otherKey: 'tag_id',
  as: 'tags',
});
Tag.belongsToMany(Customer, {
  through: CustomerTag,
  foreignKey: 'tag_id',
  otherKey: 'customer_id',
  as: 'customers',
});

Tenant.hasMany(WeworkChannelGroup, { foreignKey: 'tenant_id' });
WeworkChannelGroup.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(WeworkChannel, { foreignKey: 'tenant_id' });
WeworkChannel.belongsTo(Tenant, { foreignKey: 'tenant_id' });
WeworkChannelGroup.hasMany(WeworkChannel, { foreignKey: 'group_id' });
WeworkChannel.belongsTo(WeworkChannelGroup, { foreignKey: 'group_id', as: 'group' });

Tenant.hasMany(WeworkCustomerAddRecord, { foreignKey: 'tenant_id' });
WeworkCustomerAddRecord.belongsTo(Tenant, { foreignKey: 'tenant_id' });
WeworkChannel.hasMany(WeworkCustomerAddRecord, { foreignKey: 'channel_id' });
WeworkCustomerAddRecord.belongsTo(WeworkChannel, { foreignKey: 'channel_id' });
Tenant.hasOne(WeworkToken, { foreignKey: 'tenant_id' });
WeworkToken.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(AuditLog, { foreignKey: 'tenant_id' });
AuditLog.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(AuditLog, { foreignKey: 'actor_user_id' });
AuditLog.belongsTo(User, { foreignKey: 'actor_user_id', as: 'actor' });

Tenant.hasMany(AdClickRecord, { foreignKey: 'tenant_id' });
AdClickRecord.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(AdConversionEvent, { foreignKey: 'tenant_id' });
AdConversionEvent.belongsTo(Tenant, { foreignKey: 'tenant_id' });
AdClickRecord.hasMany(AdConversionEvent, { foreignKey: 'ad_click_id' });
AdConversionEvent.belongsTo(AdClickRecord, { foreignKey: 'ad_click_id' });

Tenant.hasMany(Campaign, { foreignKey: 'tenant_id' });
Campaign.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Campaign.hasMany(CampaignEnrollment, { foreignKey: 'campaign_id' });
CampaignEnrollment.belongsTo(Campaign, { foreignKey: 'campaign_id' });
CampaignEnrollment.belongsTo(Customer, { foreignKey: 'customer_id' });
Customer.hasMany(CampaignEnrollment, { foreignKey: 'customer_id' });
Campaign.hasMany(CampaignRewardJob, { foreignKey: 'campaign_id' });
CampaignRewardJob.belongsTo(Campaign, { foreignKey: 'campaign_id' });
Customer.hasMany(CampaignRewardJob, { foreignKey: 'customer_id' });
CampaignRewardJob.belongsTo(Customer, { foreignKey: 'customer_id' });
CampaignEnrollment.hasMany(CampaignRewardJob, { foreignKey: 'enrollment_id' });
CampaignRewardJob.belongsTo(CampaignEnrollment, { foreignKey: 'enrollment_id' });
Tenant.hasMany(CampaignRewardJob, { foreignKey: 'tenant_id' });
CampaignRewardJob.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Campaign.hasMany(InviteRecord, { foreignKey: 'campaign_id' });
InviteRecord.belongsTo(Campaign, { foreignKey: 'campaign_id' });
InviteRecord.belongsTo(Customer, { foreignKey: 'inviter_id', as: 'inviter' });
InviteRecord.belongsTo(Customer, { foreignKey: 'invitee_id', as: 'invitee' });

Tenant.hasMany(OmniChannel, { foreignKey: 'tenant_id' });
OmniChannel.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(InboxThread, { foreignKey: 'tenant_id' });
InboxThread.belongsTo(Tenant, { foreignKey: 'tenant_id' });
OmniChannel.hasMany(InboxThread, { foreignKey: 'channel_id' });
InboxThread.belongsTo(OmniChannel, { foreignKey: 'channel_id', as: 'channel' });
Customer.hasMany(InboxThread, { foreignKey: 'customer_id' });
InboxThread.belongsTo(Customer, { foreignKey: 'customer_id' });
User.hasMany(InboxThread, { foreignKey: 'assignee_id', as: 'assigned_inbox_threads' });
InboxThread.belongsTo(User, { foreignKey: 'assignee_id', as: 'assignee' });

InboxThread.hasMany(InboxMessage, { foreignKey: 'thread_id' });
InboxMessage.belongsTo(InboxThread, { foreignKey: 'thread_id' });
Tenant.hasMany(InboxMessage, { foreignKey: 'tenant_id' });
InboxMessage.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(KbDocument, { foreignKey: 'tenant_id' });
KbDocument.belongsTo(Tenant, { foreignKey: 'tenant_id' });
KbDocument.hasMany(KbChunk, { foreignKey: 'document_id' });
KbChunk.belongsTo(KbDocument, { foreignKey: 'document_id' });

InboxThread.hasMany(AiReplyLog, { foreignKey: 'thread_id' });
AiReplyLog.belongsTo(InboxThread, { foreignKey: 'thread_id' });
InboxMessage.hasMany(AiReplyLog, { foreignKey: 'trigger_message_id' });
AiReplyLog.belongsTo(InboxMessage, { foreignKey: 'trigger_message_id', as: 'trigger_message' });
User.hasMany(AiReplyLog, { foreignKey: 'approved_by', as: 'approved_ai_replies' });
AiReplyLog.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

Tenant.hasMany(InboxFollowupTask, { foreignKey: 'tenant_id' });
InboxFollowupTask.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.hasMany(InboxFollowupTask, { foreignKey: 'customer_id' });
InboxFollowupTask.belongsTo(Customer, { foreignKey: 'customer_id' });
InboxThread.hasMany(InboxFollowupTask, { foreignKey: 'thread_id' });
InboxFollowupTask.belongsTo(InboxThread, { foreignKey: 'thread_id' });

Tenant.hasMany(CustomerOrder, { foreignKey: 'tenant_id' });
CustomerOrder.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.hasMany(CustomerOrder, { foreignKey: 'customer_id' });
CustomerOrder.belongsTo(Customer, { foreignKey: 'customer_id' });

Tenant.hasMany(ServiceTicket, { foreignKey: 'tenant_id' });
ServiceTicket.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.hasMany(ServiceTicket, { foreignKey: 'customer_id' });
ServiceTicket.belongsTo(Customer, { foreignKey: 'customer_id' });
CustomerOrder.hasMany(ServiceTicket, { foreignKey: 'order_id' });
ServiceTicket.belongsTo(CustomerOrder, { foreignKey: 'order_id' });
InboxThread.hasMany(ServiceTicket, { foreignKey: 'thread_id' });
ServiceTicket.belongsTo(InboxThread, { foreignKey: 'thread_id' });
User.hasMany(ServiceTicket, { foreignKey: 'owner_id', as: 'owned_tickets' });
ServiceTicket.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

Tenant.hasMany(AiGenerationLog, { foreignKey: 'tenant_id' });
AiGenerationLog.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(AiGenerationLog, { foreignKey: 'user_id' });
AiGenerationLog.belongsTo(User, { foreignKey: 'user_id' });
Customer.hasMany(AiGenerationLog, { foreignKey: 'customer_id' });
AiGenerationLog.belongsTo(Customer, { foreignKey: 'customer_id' });

Tenant.hasMany(AutomationRule, { foreignKey: 'tenant_id' });
AutomationRule.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(AutomationLog, { foreignKey: 'tenant_id' });
AutomationLog.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.hasMany(AutomationLog, { foreignKey: 'customer_id' });
AutomationLog.belongsTo(Customer, { foreignKey: 'customer_id' });
AutomationRule.hasMany(AutomationLog, { foreignKey: 'rule_id' });
AutomationLog.belongsTo(AutomationRule, { foreignKey: 'rule_id' });

Tenant.hasMany(CustomerScore, { foreignKey: 'tenant_id' });
CustomerScore.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.hasMany(CustomerScore, { foreignKey: 'customer_id' });
CustomerScore.belongsTo(Customer, { foreignKey: 'customer_id' });

Tenant.hasMany(Flow, { foreignKey: 'tenant_id' });
Flow.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(Flow, { foreignKey: 'created_by', as: 'created_flows' });
Flow.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

Flow.hasMany(FlowNode, { foreignKey: 'flow_id' });
FlowNode.belongsTo(Flow, { foreignKey: 'flow_id' });
Flow.hasMany(FlowEdge, { foreignKey: 'flow_id' });
FlowEdge.belongsTo(Flow, { foreignKey: 'flow_id' });

Tenant.hasMany(FlowRun, { foreignKey: 'tenant_id' });
FlowRun.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Flow.hasMany(FlowRun, { foreignKey: 'flow_id' });
FlowRun.belongsTo(Flow, { foreignKey: 'flow_id' });
Customer.hasMany(FlowRun, { foreignKey: 'customer_id' });
FlowRun.belongsTo(Customer, { foreignKey: 'customer_id' });

Tenant.hasMany(AutoMessageLog, { foreignKey: 'tenant_id' });
AutoMessageLog.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.hasMany(AutoMessageLog, { foreignKey: 'customer_id' });
AutoMessageLog.belongsTo(Customer, { foreignKey: 'customer_id' });
FlowRun.hasMany(AutoMessageLog, { foreignKey: 'flow_run_id' });
AutoMessageLog.belongsTo(FlowRun, { foreignKey: 'flow_run_id' });

Tenant.hasMany(BroadcastTask, { foreignKey: 'tenant_id' });
BroadcastTask.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(BroadcastTask, { foreignKey: 'created_by' });
BroadcastTask.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

BroadcastTask.hasMany(BroadcastTaskRecipient, { foreignKey: 'broadcast_task_id' });
BroadcastTaskRecipient.belongsTo(BroadcastTask, { foreignKey: 'broadcast_task_id' });
Customer.hasMany(BroadcastTaskRecipient, { foreignKey: 'customer_id' });
BroadcastTaskRecipient.belongsTo(Customer, { foreignKey: 'customer_id' });

Tenant.hasMany(PageVisit, { foreignKey: 'tenant_id' });
PageVisit.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(PageVisit, { foreignKey: 'user_id' });
PageVisit.belongsTo(User, { foreignKey: 'user_id' });

Tenant.hasMany(MarketingEvent, { foreignKey: 'tenant_id' });
MarketingEvent.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(MarketingEvent, { foreignKey: 'user_id' });
MarketingEvent.belongsTo(User, { foreignKey: 'user_id' });
AdClickRecord.hasMany(MarketingEvent, { foreignKey: 'ad_hit' });
MarketingEvent.belongsTo(AdClickRecord, { foreignKey: 'ad_hit' });

Tenant.hasMany(AdSpendDaily, { foreignKey: 'tenant_id' });
AdSpendDaily.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(AggAdsRoiDaily, { foreignKey: 'tenant_id' });
AggAdsRoiDaily.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(AggChannelDaily, { foreignKey: 'tenant_id' });
AggChannelDaily.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(AggregationMeta, { foreignKey: 'tenant_id' });
AggregationMeta.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(IntentAlert, { foreignKey: 'tenant_id' });
IntentAlert.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Customer.hasMany(IntentAlert, { foreignKey: 'customer_id' });
IntentAlert.belongsTo(Customer, { foreignKey: 'customer_id' });
User.hasMany(IntentAlert, { foreignKey: 'owner_id', as: 'owned_intent_alerts' });
IntentAlert.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

Tenant.hasMany(MigrationCampaign, { foreignKey: 'tenant_id' });
MigrationCampaign.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(MigrationCampaign, { foreignKey: 'created_by', as: 'created_migration_campaigns' });
MigrationCampaign.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
WeworkChannel.hasMany(MigrationCampaign, { foreignKey: 'channel_live_code_id' });
MigrationCampaign.belongsTo(WeworkChannel, { foreignKey: 'channel_live_code_id', as: 'live_channel' });

Tenant.hasMany(MigrationRecord, { foreignKey: 'tenant_id' });
MigrationRecord.belongsTo(Tenant, { foreignKey: 'tenant_id' });
MigrationCampaign.hasMany(MigrationRecord, { foreignKey: 'campaign_id' });
MigrationRecord.belongsTo(MigrationCampaign, { foreignKey: 'campaign_id' });
Customer.hasMany(MigrationRecord, { foreignKey: 'customer_id' });
MigrationRecord.belongsTo(Customer, { foreignKey: 'customer_id' });
User.hasMany(MigrationRecord, { foreignKey: 'owner_id', as: 'owned_migration_records' });
MigrationRecord.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

Tenant.hasMany(CustomerTransfer, { foreignKey: 'tenant_id' });
CustomerTransfer.belongsTo(Tenant, { foreignKey: 'tenant_id' });
CustomerTransfer.belongsTo(User, { foreignKey: 'from_user_id', as: 'from_user' });
CustomerTransfer.belongsTo(User, { foreignKey: 'to_user_id', as: 'to_user' });
CustomerTransfer.belongsTo(User, { foreignKey: 'initiated_by', as: 'initiator' });
Tenant.hasMany(ImportJob, { foreignKey: 'tenant_id' });
ImportJob.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(ImportJob, { foreignKey: 'created_by', as: 'created_import_jobs' });
ImportJob.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Plan.hasMany(Subscription, { foreignKey: 'plan_id' });
Subscription.belongsTo(Plan, { foreignKey: 'plan_id', as: 'plan' });
Tenant.hasOne(Subscription, { foreignKey: 'tenant_id' });
Subscription.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Tenant.hasMany(UsageStat, { foreignKey: 'tenant_id' });
UsageStat.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Plan.hasMany(PaymentRecord, { foreignKey: 'plan_id' });
PaymentRecord.belongsTo(Plan, { foreignKey: 'plan_id', as: 'plan' });
Tenant.hasMany(PaymentRecord, { foreignKey: 'tenant_id' });
PaymentRecord.belongsTo(Tenant, { foreignKey: 'tenant_id' });
CallRecord.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
CallRecord.belongsTo(User, { foreignKey: 'caller_user_id', as: 'caller' });
Customer.hasMany(CallRecord, { foreignKey: 'customer_id', as: 'callRecords' });
UserCallSetting.belongsTo(User, { foreignKey: 'user_id' });

Tenant.hasMany(CustomerGroup, { foreignKey: 'tenant_id' });
CustomerGroup.belongsTo(Tenant, { foreignKey: 'tenant_id' });
CustomerGroup.belongsTo(User, {
  foreignKey: 'owner_user_id',
  as: 'owner',
  constraints: false,
});
CustomerGroup.hasMany(GroupMember, {
  foreignKey: 'group_id',
  as: 'members',
});
GroupMember.belongsTo(CustomerGroup, { foreignKey: 'group_id' });
GroupMember.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer',
  constraints: false,
});

Tenant.hasMany(GroupSopTask, { foreignKey: 'tenant_id' });
GroupSopTask.belongsTo(Tenant, { foreignKey: 'tenant_id' });
GroupSopTask.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator',
});
GroupSopTask.hasMany(GroupSopTarget, {
  foreignKey: 'sop_task_id',
  as: 'targets',
});
GroupSopTarget.belongsTo(GroupSopTask, {
  foreignKey: 'sop_task_id',
  as: 'sopTask',
});
GroupSopTarget.belongsTo(CustomerGroup, {
  foreignKey: 'group_id',
  as: 'group',
});

Tenant.hasMany(GroupSendLog, { foreignKey: 'tenant_id' });
GroupSendLog.belongsTo(Tenant, { foreignKey: 'tenant_id' });
GroupSendLog.belongsTo(CustomerGroup, {
  foreignKey: 'group_id',
  as: 'group',
});
GroupSendLog.belongsTo(GroupSopTask, {
  foreignKey: 'sop_task_id',
  as: 'sopTask',
  constraints: false,
});
SmsTask.belongsTo(SmsTemplate, { foreignKey: 'template_id', as: 'template' });
SmsTask.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
SmsSendLog.belongsTo(SmsTask, {
  foreignKey: 'task_id',
  as: 'task',
  constraints: false,
});
SmsSendLog.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer',
  constraints: false,
});
Tenant.hasMany(ScriptLibraryItem, { foreignKey: 'tenant_id' });
ScriptLibraryItem.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(ScriptLibraryItem, { foreignKey: 'created_by', as: 'created_script_items' });
ScriptLibraryItem.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

export {
  sequelize,
  Tenant,
  Role,
  User,
  Customer,
  CustomerFollowUp,
  Tag,
  CustomerTag,
  WeworkChannelGroup,
  WeworkChannel,
  WeworkCustomerAddRecord,
  WeworkCustomerMessage,
  WeworkToken,
  AuditLog,
  AdClickRecord,
  Campaign,
  CampaignEnrollment,
  CampaignRewardJob,
  InviteRecord,
  AiGenerationLog,
  AutomationRule,
  AutomationLog,
  CustomerScore,
  Flow,
  FlowNode,
  FlowEdge,
  FlowRun,
  AutoMessageLog,
  BroadcastTask,
  BroadcastTaskRecipient,
  RegistrationOtpChallenge,
  PageVisit,
  AdConversionEvent,
  MarketingEvent,
  AdSpendDaily,
  BackgroundJob,
  AggAdsRoiDaily,
  AggChannelDaily,
  AggregationMeta,
  IntentAlert,
  MigrationCampaign,
  MigrationRecord,
  CustomerTransfer,
  ImportJob,
  Plan,
  Subscription,
  UsageStat,
  PaymentRecord,
  CallRecord,
  UserCallSetting,
  CustomerGroup,
  GroupMember,
  GroupSopTask,
  GroupSopTarget,
  GroupSendLog,
  SmsTemplate,
  SmsTask,
  SmsSendLog,
  ScriptLibraryItem,
  OmniChannel,
  InboxThread,
  InboxMessage,
  KbDocument,
  KbChunk,
  AiReplyLog,
  InboxFollowupTask,
  CustomerOrder,
  ServiceTicket,
  TenantLeadSetting,
  TenantPublicWebhookSetting,
};
