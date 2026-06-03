/**
 * @file 应用根组件：路由表（登录/注册 + 受保护的后台区域）。
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { DashboardHomePage } from '@/pages/DashboardHomePage'
import { UsersPage } from '@/pages/UsersPage'
import { RolesPage } from '@/pages/RolesPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { CustomersPipelinePage } from '@/pages/CustomersPipelinePage'
import { AutomationRulesPage } from '@/pages/AutomationRulesPage'
import { FollowUpsPage } from '@/pages/FollowUpsPage'
import { TagsPage } from '@/pages/TagsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { WeworkCallbackPage } from '@/pages/WeworkCallbackPage'
import { ChannelLiveCodePage } from '@/pages/ChannelLiveCodePage'
import { AICopywritingPage } from '@/pages/AICopywritingPage'
import { AiAssistantPage } from '@/pages/AiAssistantPage'
import { CampaignsPage } from '@/pages/CampaignsPage'
import { CampaignFormPage } from '@/pages/CampaignFormPage'
import { CampaignDetailPage } from '@/pages/CampaignDetailPage'
import { BroadcastTasksPage } from '@/pages/BroadcastTasksPage'
import { MigrationPage } from '@/pages/MigrationPage'
import { TransferPage } from '@/pages/TransferPage'
import { BillingPage } from '@/pages/BillingPage'
import { GuideTemplatesPage } from '@/pages/GuideTemplatesPage'
import { AcquisitionWizardPage } from '@/pages/AcquisitionWizardPage'
import { AiEmployeePlaybookPage } from '@/pages/AiEmployeePlaybookPage'
import { FlowBuilderPage } from '@/pages/FlowBuilderPage'
import { FlowsListPage } from '@/pages/FlowsListPage'
import { ChannelReportPage } from '@/pages/ChannelReportPage'
import { AdsRoiPage } from '@/pages/AdsRoiPage'
import { AuditLogsPage } from '@/pages/AuditLogsPage'
import { IntentAlertsPage } from '@/pages/IntentAlertsPage'
import { PermissionCheckPage } from '@/pages/PermissionCheckPage'
import SidebarApp from '@/pages/sidebar/SidebarApp'
import SidebarCustomer from '@/pages/sidebar/SidebarCustomer'
import SidebarScript from '@/pages/sidebar/SidebarScript'
import { GroupsPage } from '@/pages/GroupsPage'
import { CallRecordsPage } from '@/pages/CallRecordsPage'
import { SmsPage } from '@/pages/SmsPage'
import { DemoPreviewPage } from '@/pages/DemoPreviewPage'
import { CustomerDetailPage } from '@/pages/CustomerDetailPage'
import { ScriptLibraryPage } from '@/pages/ScriptLibraryPage'
import { InboxPage } from '@/pages/InboxPage'
import { AiReviewPage } from '@/pages/AiReviewPage'
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage'
import { AiOpsPage } from '@/pages/AiOpsPage'
import { ServiceDeskPage } from '@/pages/ServiceDeskPage'
import { TicketDetailPage } from '@/pages/TicketDetailPage'
import { HelpCenterPage } from '@/pages/HelpCenterPage'
import { CustomFieldsSettingsPage } from '@/pages/CustomFieldsSettingsPage'
import { PipelineSettingsPage } from '@/pages/PipelineSettingsPage'
import { DashboardLayoutSettingsPage } from '@/pages/DashboardLayoutSettingsPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import NotificationsPage from '@/pages/NotificationsPage'
import ApprovalsPage from '@/pages/ApprovalsPage'
import ApprovalTemplatesPage from '@/pages/ApprovalTemplatesPage'
import ProductsPage from '@/pages/ProductsPage'
import OrdersPage from '@/pages/OrdersPage'
import ContractListPage from '@/pages/ContractListPage'
import ContractDetailPage from '@/pages/ContractDetailPage'
import TaskListPage from '@/pages/TaskListPage'
import MarketingCampaignPage from '@/pages/MarketingCampaignPage'
import MessageTemplatePage from '@/pages/MessageTemplatePage'
import MarketingDashboardPage from '@/pages/MarketingDashboardPage'
import SegmentListPage from '@/pages/SegmentListPage'
import KbArticlePage from '@/pages/KbArticlePage'
import NotificationRulesPage from '@/pages/NotificationRulesPage'
import CoachPage from '@/pages/CoachPage'
import { ReferralManagementPage } from '@/pages/ReferralManagementPage'
import AiCustomerServicePage from '@/pages/AiCustomerServicePage'
import EmployeeActivityPage from '@/pages/EmployeeActivityPage'
import { SyzsCallbackPage } from '@/pages/SyzsCallbackPage'
import { PlatformAdminRoute } from '@/components/auth/PlatformAdminRoute'
import { PlatformOverviewPage } from '@/pages/platform/PlatformOverviewPage'
import { PlatformTenantsPage } from '@/pages/platform/PlatformTenantsPage'
import { PlatformTenantDetailPage } from '@/pages/platform/PlatformTenantDetailPage'
import { PlatformBillingPage } from '@/pages/platform/PlatformBillingPage'
import { PlatformChurnRisksPage } from '@/pages/platform/PlatformChurnRisksPage'
import { PlatformExpiringSubscriptionsPage } from '@/pages/platform/PlatformExpiringSubscriptionsPage'
import { PlatformOpsFollowupsPage } from '@/pages/platform/PlatformOpsFollowupsPage'
import { PlatformInboxAiAnomaliesPage } from '@/pages/platform/PlatformInboxAiAnomaliesPage'
import LandingPageList from '@/pages/LandingPageList'
import LandingPageBuilder from '@/pages/LandingPageBuilder'
import LandingSubmissionsPage from '@/pages/LandingSubmissionsPage'
import LandingPageView from '@/pages/LandingPageView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/demo" replace />} />
        <Route path="/demo" element={<DemoPreviewPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/wework/callback" element={<WeworkCallbackPage />} />
        <Route path="/syzs/callback" element={<SyzsCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<DashboardHomePage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="custom-fields" element={<CustomFieldsSettingsPage />} />
            <Route path="pipeline-settings" element={<PipelineSettingsPage />} />
            <Route path="dashboard-layout" element={<DashboardLayoutSettingsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="transfers" element={<TransferPage />} />
            <Route path="tags" element={<TagsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/pipeline" element={<CustomersPipelinePage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="automation-rules" element={<AutomationRulesPage />} />
            <Route path="call-records" element={<CallRecordsPage />} />
            <Route path="follow-ups" element={<FollowUpsPage />} />
            <Route path="channel-live" element={<ChannelLiveCodePage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="ai-copy" element={<AICopywritingPage />} />
            <Route path="ai-assistant" element={<AiAssistantPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="ai-review" element={<AiReviewPage />} />
            <Route path="knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="ai-ops" element={<AiOpsPage />} />
            <Route path="service-desk" element={<ServiceDeskPage />} />
            <Route path="service-desk/tickets/:id" element={<TicketDetailPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="campaigns/new" element={<CampaignFormPage />} />
            <Route path="campaigns/:id/edit" element={<CampaignFormPage />} />
            <Route path="campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="migration" element={<MigrationPage />} />
            <Route path="broadcast-tasks" element={<BroadcastTasksPage />} />
            <Route path="sms" element={<SmsPage />} />
            <Route path="script-library" element={<ScriptLibraryPage />} />
            <Route path="guide-templates" element={<GuideTemplatesPage />} />
            <Route path="acquisition-wizard" element={<AcquisitionWizardPage />} />
            <Route path="ai-employee-playbook" element={<AiEmployeePlaybookPage />} />
            <Route path="flow-builder" element={<FlowBuilderPage />} />
            <Route path="flows" element={<FlowsListPage />} />
            <Route path="channel-report" element={<ChannelReportPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="approval-templates" element={<ApprovalTemplatesPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="contracts" element={<ContractListPage />} />
            <Route path="contracts/:id" element={<ContractDetailPage />} />
            <Route path="tasks" element={<TaskListPage />} />
            <Route path="referrals" element={<ReferralManagementPage />} />
            <Route path="ai-cs" element={<AiCustomerServicePage />} />
            <Route path="employee-activity" element={<EmployeeActivityPage />} />
            <Route path="marketing-campaigns" element={<MarketingCampaignPage />} />
            <Route path="message-templates" element={<MessageTemplatePage />} />
            <Route path="marketing-dashboard" element={<MarketingDashboardPage />} />
            <Route path="customer-segments" element={<SegmentListPage />} />
            <Route path="kb-articles" element={<KbArticlePage />} />
            <Route path="notification-rules" element={<NotificationRulesPage />} />
            <Route path="ai-coach" element={<CoachPage />} />
            <Route path="ads-roi" element={<AdsRoiPage />} />
            <Route path="intent-alerts" element={<IntentAlertsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="permission-check" element={<PermissionCheckPage />} />
            <Route path="help" element={<HelpCenterPage />} />
            <Route path="landing-pages" element={<LandingPageList />} />
            <Route path="landing-pages/:id/edit" element={<LandingPageBuilder />} />
            <Route path="landing-pages/:id/submissions" element={<LandingSubmissionsPage />} />
            <Route
              path="platform"
              element={
                <PlatformAdminRoute>
                  <PlatformOverviewPage />
                </PlatformAdminRoute>
              }
            />
            <Route
              path="platform/tenants"
              element={
                <PlatformAdminRoute>
                  <PlatformTenantsPage />
                </PlatformAdminRoute>
              }
            />
            <Route
              path="platform/tenants/:tenantId"
              element={
                <PlatformAdminRoute>
                  <PlatformTenantDetailPage />
                </PlatformAdminRoute>
              }
            />
            <Route
              path="platform/billing"
              element={
                <PlatformAdminRoute>
                  <PlatformBillingPage />
                </PlatformAdminRoute>
              }
            />
            <Route
              path="platform/churn-risks"
              element={
                <PlatformAdminRoute>
                  <PlatformChurnRisksPage />
                </PlatformAdminRoute>
              }
            />
            <Route
              path="platform/subscriptions/expiring"
              element={
                <PlatformAdminRoute>
                  <PlatformExpiringSubscriptionsPage />
                </PlatformAdminRoute>
              }
            />
            <Route
              path="platform/inbox-ai-anomalies"
              element={
                <PlatformAdminRoute>
                  <PlatformInboxAiAnomaliesPage />
                </PlatformAdminRoute>
              }
            />
            <Route
              path="platform/ops-followups"
              element={
                <PlatformAdminRoute>
                  <PlatformOpsFollowupsPage />
                </PlatformAdminRoute>
              }
            />
          </Route>
        </Route>

        <Route path="/sidebar" element={<SidebarApp />} />
        <Route path="/sidebar/customer" element={<SidebarCustomer />} />
        <Route path="/sidebar/script" element={<SidebarScript />} />

        <Route path="/lp/:slug" element={<LandingPageView />} />

        <Route path="*" element={<Navigate to="/demo" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
