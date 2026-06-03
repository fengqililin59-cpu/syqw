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
        /** 收件箱 AI：仅 p0/高置信 FAQ 类自动发送，投诉等仍人工审核 */
        inbox_ai_auto_send: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        /** 收件箱 AI：p1 询价类高置信自动发送（合同/底价等关键词仍拦截） */
        inbox_ai_auto_send_pricing: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        /** AI 自动回复后企微提醒会话负责人 */
        inbox_ai_notify_assignee_on_auto_send: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        inbox_ai_platform_disabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        /** 租户级收件箱自动草稿开关：新消息到达时自动生成AI草稿并尝试发送 */
        inbox_auto_draft_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      },
      { sequelize, modelName: 'Tenant', tableName: 'tenants' }
    );
    return Tenant;
  }
}
