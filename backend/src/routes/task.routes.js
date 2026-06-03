import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import * as ctrl from '../controllers/task.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', ctrl.taskStats);
router.get('/my', ctrl.myTasks);
router.get('/', ctrl.listTasks);
router.get('/:id', ctrl.getTask);
router.post('/', ctrl.createTask);
router.put('/:id', ctrl.updateTask);
router.delete('/:id', ctrl.deleteTask);

export default router;
