/**
 * @file 进件报件控制器
 */
import * as loanAppService from '../services/loanApplication.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'

// ===== 进件 CRUD =====

/** GET /api/loan-applications */
export const listApplications = asyncHandler(async (req, res) => {
  const result = await loanAppService.listApplications(req.auth, req.query)
  res.json(result)
})

/** GET /api/loan-applications/:id */
export const getApplication = asyncHandler(async (req, res) => {
  const result = await loanAppService.getApplication(req.auth, req.params.id)
  res.json(result)
})

/** POST /api/loan-applications */
export const createApplication = asyncHandler(async (req, res) => {
  const result = await loanAppService.createApplication(req.auth, req.body)
  res.status(201).json(result)
})

/** PUT /api/loan-applications/:id */
export const updateApplication = asyncHandler(async (req, res) => {
  const result = await loanAppService.updateApplication(req.auth, req.params.id, req.body)
  res.json(result)
})

/** DELETE /api/loan-applications/:id */
export const deleteApplication = asyncHandler(async (req, res) => {
  const result = await loanAppService.deleteApplication(req.auth, req.params.id)
  res.json(result)
})

// ===== 进件状态流转 =====

/** POST /api/loan-applications/:id/submit */
export const submitApplication = asyncHandler(async (req, res) => {
  const result = await loanAppService.submitApplication(req.auth, req.params.id)
  res.json(result)
})

/** POST /api/loan-applications/:id/approve */
export const approveApplication = asyncHandler(async (req, res) => {
  const result = await loanAppService.approveApplication(req.auth, req.params.id, req.body)
  res.json(result)
})

/** POST /api/loan-applications/:id/reject */
export const rejectApplication = asyncHandler(async (req, res) => {
  const result = await loanAppService.rejectApplication(req.auth, req.params.id, req.body)
  res.json(result)
})

/** POST /api/loan-applications/:id/disburse */
export const disburseApplication = asyncHandler(async (req, res) => {
  const result = await loanAppService.disburseApplication(req.auth, req.params.id, req.body)
  res.json(result)
})

// ===== 客户进件记录 =====

/** GET /api/customers/:id/applications */
export const getCustomerApplications = asyncHandler(async (req, res) => {
  const result = await loanAppService.getCustomerApplications(req.auth, req.params.id)
  res.json(result)
})

// ===== 进件材料 =====

/** POST /api/loan-applications/:id/materials */
export const addMaterial = asyncHandler(async (req, res) => {
  const result = await loanAppService.addMaterial(req.auth, req.params.id, req.body)
  res.status(201).json(result)
})

/** DELETE /api/loan-materials/:id */
export const deleteMaterial = asyncHandler(async (req, res) => {
  const result = await loanAppService.deleteMaterial(req.auth, req.params.id)
  res.json(result)
})
