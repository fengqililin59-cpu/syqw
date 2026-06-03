/**
 * @file 消息通知模型 — 站内通知中心。
 * 支持：线索分配、跟进提醒、阶段变更、系统公告等通知类型。
 */
import { DataTypes, Model } from 'sequelize';

export class Notification extends Model {
  static initModel(sequelize) {
    Notification.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        recipient_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        type: {
          type: DataTypes.ENUM(
            'lead_assigned',       // 线索分配
            'followup_reminder',   // 跟进提醒
            'stage_changed',       // 阶段变更
            'customer_transferred',// 客户转移
            'deal_won',            // 成交
            'deal_lost',           // 丢单
            'comment_added',       // 新增评论
            'task_assigned',       // 任务分配
            'system_notice',       // 系统公告
            'ai_alert',            // AI预警
          ),
          allowNull: false,
        },
        title: { type: DataTypes.STRING(255), allowNull: false },
        body: { type: DataTypes.TEXT, allowNull: true },
        related_type: { type: DataTypes.STRING(32), allowNull: true },
        related_id: { type: DataTypes.STRING(64), allowNull: true },
        is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        read_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'Notification',
        tableName: 'notifications',
        underscored: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
          { fields: ['tenant_id', 'recipient_user_id', 'is_read'] },
          { fields: ['recipient_user_id', 'created_at'] },
          { fields: ['related_type', 'related_id'] },
        ],
      },
    );
    return Notification;
  }
}
