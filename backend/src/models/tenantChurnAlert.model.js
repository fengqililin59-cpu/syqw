/**
 * @file 租户流失预警发送记录。
 */
import { DataTypes, Model } from 'sequelize';

export class TenantChurnAlert extends Model {
  static initModel(sequelize) {
    TenantChurnAlert.init(
      {
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
        alert_key: { type: DataTypes.STRING(64), primaryKey: true },
        sent_at: { type: DataTypes.DATE, allowNull: false },
        detail: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'TenantChurnAlert',
        tableName: 'tenant_churn_alerts',
        underscored: true,
        timestamps: false,
      },
    );
    return TenantChurnAlert;
  }
}
