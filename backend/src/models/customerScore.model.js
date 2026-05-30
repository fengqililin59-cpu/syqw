/**
 * @file 客户意向评分历史快照。
 */
import { DataTypes, Model } from 'sequelize';

export class CustomerScore extends Model {
  static initModel(sequelize) {
    CustomerScore.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        rule_score: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
        ai_score: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
        final_score: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
        intent_stage: { type: DataTypes.STRING(64), allowNull: true },
        confidence: { type: DataTypes.STRING(10), allowNull: true },
        reason_snippet: { type: DataTypes.STRING(500), allowNull: true },
      },
      {
        sequelize,
        modelName: 'CustomerScore',
        tableName: 'customer_scores',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
    return CustomerScore;
  }
}
