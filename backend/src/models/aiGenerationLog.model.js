/**
 * @file AI 生成记录（回复建议等）。
 */
import { DataTypes, Model } from 'sequelize';

export class AiGenerationLog extends Model {
  static initModel(sequelize) {
    AiGenerationLog.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        kind: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'reply_suggestions' },
        input_message: { type: DataTypes.TEXT, allowNull: false },
        output_json: { type: DataTypes.JSON, allowNull: false },
        model: { type: DataTypes.STRING(64), allowNull: true },
        meta_json: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'AiGenerationLog',
        tableName: 'ai_generation_logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
    return AiGenerationLog;
  }
}
