/**
 * @file 企业（租户）模型。
 */
import { DataTypes, Model } from 'sequelize';

export class Tenant extends Model {
  static initModel(sequelize) {
    Tenant.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(100), allowNull: false },
        corp_id: { type: DataTypes.STRING(64), allowNull: true },
        corp_secret: { type: DataTypes.STRING(255), allowNull: true },
        wework_corp_id: { type: DataTypes.STRING(64), allowNull: true },
        wework_agent_id: { type: DataTypes.STRING(64), allowNull: true },
        tccc_sdk_app_id: { type: DataTypes.STRING(64), allowNull: true },
        tccc_secret_id: { type: DataTypes.STRING(128), allowNull: true },
        tccc_secret_key: { type: DataTypes.STRING(128), allowNull: true },
        tccc_server_number: { type: DataTypes.STRING(20), allowNull: true },
        sms_access_key_id: { type: DataTypes.STRING(128), allowNull: true },
        sms_access_key_secret: { type: DataTypes.STRING(128), allowNull: true },
        sms_default_sign: { type: DataTypes.STRING(50), allowNull: true },
        is_demo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        demo_expires_at: { type: DataTypes.DATE, allowNull: true },
        wework_secret: { type: DataTypes.STRING(255), allowNull: true },
        /** 回调 URL 验证等场景的可选 Token（与自建应用配置一致时填写） */
        wework_token: { type: DataTypes.STRING(64), allowNull: true },
        /** 消息回调解密 EncodingAESKey（43 位环境变量形式，存库最长 86） */
        wework_encoding_aes_key: { type: DataTypes.STRING(86), allowNull: true },
        contact_name: { type: DataTypes.STRING(50), allowNull: true },
        contact_phone: { type: DataTypes.STRING(20), allowNull: true },
        plan: { type: DataTypes.ENUM('free', 'basic', 'pro'), allowNull: false, defaultValue: 'free' },
        max_users: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
        expired_at: { type: DataTypes.DATE, allowNull: true },
        status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        /** 是否允许流程等自动向客户直发企微消息 */
        allow_auto_send: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      },
      { sequelize, modelName: 'Tenant', tableName: 'tenants' }
    );
    return Tenant;
  }
}
