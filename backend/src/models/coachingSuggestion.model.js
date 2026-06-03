import { DataTypes, Model } from 'sequelize';

export class CoachingSuggestion extends Model {
  static initModel(sequelize) {
    CoachingSuggestion.init({
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      tenant_id: { type: DataTypes.BIGINT, allowNull: false },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      coach_type: {
        type: DataTypes.STRING(32),
        allowNull: false,
        comment: 'followup/call/deal/develop/time/overall',
      },
      title: { type: DataTypes.STRING(120), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      context_data: { type: DataTypes.JSON, allowNull: true },
      priority: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 3 },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'active',
      },
      impact_score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      generated_by: { type: DataTypes.STRING(64), allowNull: true },
      generated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      implemented_at: { type: DataTypes.DATE, allowNull: true },
      dismissed_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, {
      sequelize,
      tableName: 'ai_coach_suggestions',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    });
    return CoachingSuggestion;
  }
}
