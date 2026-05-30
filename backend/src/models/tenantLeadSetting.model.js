/**
 * @file 租户线索分配配置。
 */
import { DataTypes, Model } from 'sequelize';

export class TenantLeadSetting extends Model {
  static initModel(sequelize) {
    TenantLeadSetting.init(
      {
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
        assign_mode: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'round_robin',
        },
        channel_owner_map: { type: DataTypes.JSON, allowNull: true },
        default_owner_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        round_robin_last_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        notify_wework: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      },
      {
        sequelize,
        modelName: 'TenantLeadSetting',
        tableName: 'tenant_lead_settings',
        underscored: true,
      },
    );
    return TenantLeadSetting;
  }
}
