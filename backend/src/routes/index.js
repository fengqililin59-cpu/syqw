/**
 * @file API v1 路由聚合：认证、仪表盘、用户、客户等业务模块。
 */
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import roleRoutes from './role.routes.js';
import userRoutes from './user.routes.js';
import customerRoutes from './customer.routes.js';
import followUpRoutes from './followUp.routes.js';
import tagRoutes from './tag.routes.js';
import weworkRoutes from './wework.routes.js';
import settingsRoutes from './settings.routes.js';
import channelLiveCodeRoutes from './channelLiveCode.routes.js';
import adRoutes from './ad.routes.js';
import aiRoutes from './ai.routes.js';
import automationRoutes from './automation.routes.js';
import campaignRoutes from './campaign.routes.js';
import broadcastRoutes from './broadcast.routes.js';
import syncRoutes from './sync.routes.js';
import flowRoutes from './flow.routes.js';
import trackRoutes from './track.routes.js';
import migrationRoutes from './migration.routes.js';
import transferRoutes from './transfer.routes.js';
import customerImportRoutes from './customerImport.routes.js';
import publicDemoRoutes from './publicDemo.routes.js';
import scriptLibraryRoutes from './scriptLibrary.routes.js';
import inboxRoutes from './inbox.routes.js';
import aiEmployeeRoutes from './aiEmployee.routes.js';
import ticketRoutes from './ticket.routes.js';
import leadRoutes from './lead.routes.js';

const router = Router();

router.use('/ads', adRoutes);
router.use('/auth', authRoutes);
router.use('/wework', weworkRoutes);
router.use('/settings', settingsRoutes);
router.use('/ai', aiRoutes);
router.use('/automation', automationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/transfers', transferRoutes);
router.use('/tags', tagRoutes);
router.use('/follow-ups', followUpRoutes);
router.use('/channel-live', channelLiveCodeRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/migration', migrationRoutes);
router.use('/broadcast-tasks', broadcastRoutes);
router.use('/sync', syncRoutes);
router.use('/flows', flowRoutes);
router.use('/track', trackRoutes);
router.use('/public/demo', publicDemoRoutes);
router.use('/customers/import', customerImportRoutes);
router.use('/script-library', scriptLibraryRoutes);
router.use('/inbox', inboxRoutes);
router.use('/ai-employee', aiEmployeeRoutes);
router.use('/service', ticketRoutes);
router.use('/leads', leadRoutes);
router.use('/', customerRoutes);

export default router;
