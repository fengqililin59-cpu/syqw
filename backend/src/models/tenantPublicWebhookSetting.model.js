/**
 * @file 租户公域 Webhook 验签配置。
 */
import { DataTypes, Model } from 'sequelize';

export class TenantPublicWebhookSetting extends Model {
  static initModel(sequelize) {
    TenantPublicWebhookSetting.init(
      {
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
        douyin_client_key: { type: DataTypes.STRING(64), allowNull: true },
        douyin_client_secret: { type: DataTypes.STRING(255), allowNull: true },
        douyin_verify_mode: {
          type: DataTypes.STRING(24),
          allowNull: false,
          defaultValue: 'legacy_or_platform',
        },
        xhs_webhook_token: { type: DataTypes.STRING(255), allowNull: true },
        xhs_verify_mode: {
          type: DataTypes.STRING(24),
          allowNull: false,
          defaultValue: 'legacy_or_platform',
        },
      },
      {
        sequelize,
        modelName: 'TenantPublicWebhookSetting',
        tableName: 'tenant_public_webhook_settings',
        underscored: true,
      },
    );
    return TenantPublicWebhookSetting;
  }
}
