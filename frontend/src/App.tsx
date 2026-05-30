/**
 * @file 应用根组件：路由表（登录/注册 + 受保护的后台区域）。
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
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
import { CampaignsPage } from '@/pages/CampaignsPage'
import { CampaignFormPage } from '@/pages/CampaignFormPage'
import { CampaignDetailPage } from '@/pages/CampaignDetailPage'
import { BroadcastTasksPage } from '@/pages/BroadcastTasksPage'
import { MigrationPage } from '@/pages/MigrationPage'
import { TransferPage } from '@/pages/TransferPage'
import { BillingPage } from '@/pages/BillingPage'
import { GuideTemplatesPage } from '@/pages/GuideTemplatesPage'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/demo" replace />} />
        <Route path="/demo" element={<DemoPreviewPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/wework/callback" element={<WeworkCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<DashboardHomePage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="settings" element={<SettingsPage />} />
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
            <Route path="flow-builder" element={<FlowBuilderPage />} />
            <Route path="flows" element={<FlowsListPage />} />
            <Route path="channel-report" element={<ChannelReportPage />} />
            <Route path="ads-roi" element={<AdsRoiPage />} />
            <Route path="intent-alerts" element={<IntentAlertsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="permission-check" element={<PermissionCheckPage />} />
          </Route>
        </Route>

        <Route path="/sidebar" element={<SidebarApp />} />
        <Route path="/sidebar/customer" element={<SidebarCustomer />} />
        <Route path="/sidebar/script" element={<SidebarScript />} />

        <Route path="*" element={<Navigate to="/demo" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
