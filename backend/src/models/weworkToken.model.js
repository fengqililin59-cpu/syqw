/**
 * @file 企业微信 access_token 跨进程缓存。
 */
import { DataTypes, Model } from 'sequelize';

export class WeworkToken extends Model {
  static initModel(sequelize) {
    WeworkToken.init(
      {
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, allowNull: false },
        access_token: { type: DataTypes.STRING(512), allowNull: false },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        jsapi_ticket: { type: DataTypes.STRING(256), allowNull: true },
        jsapi_ticket_expires_at: { type: DataTypes.DATE, allowNull: true },
        agent_jsapi_ticket: { type: DataTypes.STRING(256), allowNull: true },
        agent_jsapi_ticket_expires_at: { type: DataTypes.DATE, allowNull: true },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      },
      {
        sequelize,
        modelName: 'WeworkToken',
        tableName: 'wework_tokens',
        underscored: true,
        timestamps: false,
      },
    );
    return WeworkToken;
  }
}
