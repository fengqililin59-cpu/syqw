/**
 * @file 操作审计日志（高危行为留痕）。
 */
import { DataTypes, Model } from 'sequelize';

export class AuditLog extends Model {
  static initModel(sequelize) {
    AuditLog.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        actor_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        action: { type: DataTypes.STRING(64), allowNull: false },
        target_type: { type: DataTypes.STRING(32), allowNull: true },
        target_id: { type: DataTypes.STRING(64), allowNull: true },
        detail_json: { type: DataTypes.JSON, allowNull: true, field: 'payload_json' },
        ip: { type: DataTypes.STRING(45), allowNull: true },
        user_agent: { type: DataTypes.STRING(512), allowNull: true },
      },
      {
        sequelize,
        modelName: 'AuditLog',
        tableName: 'operation_audit_logs',
        underscored: true,
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
    return AuditLog;
  }
}
