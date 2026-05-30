/**
 * @file 客户模型（租户 scope、软删除、阶段为 VARCHAR 便于扩展）。
 */
import { DataTypes, Model } from 'sequelize';

export class Customer extends Model {
  static initModel(sequelize) {
    Customer.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        owner_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        external_userid: { type: DataTypes.STRING(64), allowNull: true },
        name: { type: DataTypes.STRING(50), allowNull: true },
        nickname: { type: DataTypes.STRING(50), allowNull: true },
        avatar_url: { type: DataTypes.STRING(255), allowNull: true },
        gender: { type: DataTypes.TINYINT, allowNull: true, defaultValue: 0 },
        phone: { type: DataTypes.STRING(20), allowNull: true },
        wechat_id: { type: DataTypes.STRING(50), allowNull: true },
        company: { type: DataTypes.STRING(100), allowNull: true },
        position: { type: DataTypes.STRING(50), allowNull: true },
        source: { type: DataTypes.STRING(50), allowNull: true },
        stage: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'new',
        },
        intention_level: { type: DataTypes.TINYINT, allowNull: true },
        remark: { type: DataTypes.TEXT, allowNull: true },
        /** 需求探索登记（预算、决策周期、痛点、关注产品、决策人等） */
        discovery_profile: { type: DataTypes.JSON, allowNull: true },
        last_contact_at: { type: DataTypes.DATE, allowNull: true },
        added_at: { type: DataTypes.DATE, allowNull: true },
        automation_paused: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
        automation_followup_count: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        last_automation_followup_at: { type: DataTypes.DATE, allowNull: true },
        /** 综合意向分 0-100（规则 70% + AI 30%） */
        intent_score: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        /** 高意向 / 中意向 / 低意向 */
        intent_tier: { type: DataTypes.STRING(20), allowNull: true },
        intent_stage_label: { type: DataTypes.STRING(40), allowNull: true },
        intent_confidence: { type: DataTypes.STRING(10), allowNull: true },
        intent_rule_score: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        intent_ai_score: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        last_scored_at: { type: DataTypes.DATE, allowNull: true },
        /** 意向联动引擎触达次数（与 automation_followup_count 区分） */
        followup_count: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        last_followup_at: { type: DataTypes.DATE, allowNull: true },
        /** high / medium / low */
        priority: { type: DataTypes.STRING(20), allowNull: true },
        /** 客户退订流程/自动化直发消息 */
        opt_out_auto_msg: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      },
      {
        sequelize,
        modelName: 'Customer',
        tableName: 'customers',
        paranoid: true,
        deletedAt: 'deleted_at',
        scopes: {
          tenant(tenantId) {
            return { where: { tenant_id: tenantId } };
          },
        },
      }
    );
    return Customer;
  }
}
