/**
 * @file AI 回复草稿与审核记录。
 */
import { DataTypes, Model } from 'sequelize';

export class AiReplyLog extends Model {
  static initModel(sequelize) {
    AiReplyLog.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        thread_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        trigger_message_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        intent: { type: DataTypes.STRING(64), allowNull: true },
        confidence: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
        risk_level: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'p1' },
        draft_content: { type: DataTypes.TEXT, allowNull: false },
        final_content: { type: DataTypes.TEXT, allowNull: true },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'draft' },
        model: { type: DataTypes.STRING(64), allowNull: true },
        approved_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        qa_status: { type: DataTypes.STRING(16), allowNull: true },
        qa_reviewed_at: { type: DataTypes.DATE, allowNull: true },
        qa_reviewed_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        qa_note: { type: DataTypes.STRING(500), allowNull: true },
      },
      {
        sequelize,
        modelName: 'AiReplyLog',
        tableName: 'ai_reply_logs',
        underscored: true,
      },
    );
    return AiReplyLog;
  }
}
