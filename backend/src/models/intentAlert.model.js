/**
 * @file 意向分跃升预警记录。
 */
import { DataTypes, Model } from 'sequelize';

export class IntentAlert extends Model {
  static initModel(sequelize) {
    IntentAlert.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        owner_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        score_before: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
        score_after: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
        score_delta: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
        ai_script: { type: DataTypes.TEXT, allowNull: true },
        sent_at: { type: DataTypes.DATE, allowNull: true },
        status: { type: DataTypes.ENUM('pending', 'sent', 'failed'), allowNull: false, defaultValue: 'pending' },
        created_at: { type: DataTypes.DATE, allowNull: false },
        /** 与迁移中 GENERATED 列一致：仅由 DB 根据 created_at 维护，创建时不要写入 */
        alert_date: { type: DataTypes.DATEONLY, allowNull: true },
      },
      {
        sequelize,
        modelName: 'IntentAlert',
        tableName: 'intent_alerts',
        underscored: true,
        timestamps: false,
      }
    );
    return IntentAlert;
  }
}
