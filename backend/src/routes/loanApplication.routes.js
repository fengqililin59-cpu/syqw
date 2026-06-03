/**
 * @file 进件报件路由
 */
import express from 'express'
import * as loanAppController from '../controllers/loanApplication.controller.js'
import { requirePerm } from '../middlewares/auth.middleware.js'

const router = express.Router()

// ===== 进件 CRUD =====
router.get(
  '/',
  requirePerm('customer:view'),
  loanAppController.listApplications,
)
router.post(
  '/',
  requirePerm('customer:edit'),
  loanAppController.createApplication,
)
router.get(
  '/:id',
  requirePerm('customer:view'),
  loanAppController.getApplication,
)
router.put(
  '/:id',
  requirePerm('customer:edit'),
  loanAppController.updateApplication,
)
router.delete(
  '/:id',
  requirePerm('customer:delete'),
  loanAppController.deleteApplication,
)

// ===== 状态流转 =====
router.post(
  '/:id/submit',
  requirePerm('customer:edit'),
  loanAppController.submitApplication,
)
router.post(
  '/:id/approve',
  requirePerm('customer:edit'),
  loanAppController.approveApplication,
)
router.post(
  '/:id/reject',
  requirePerm('customer:edit'),
  loanAppController.rejectApplication,
)
router.post(
  '/:id/disburse',
  requirePerm('customer:edit'),
  loanAppController.disburseApplication,
)

// ===== 进件材料 =====
router.post(
  '/:id/materials',
  requirePerm('customer:edit'),
  loanAppController.addMaterial,
)
router.delete(
  '/materials/:id',
  requirePerm('customer:edit'),
  loanAppController.deleteMaterial,
)

export default router
