/**
 * @file 个人微信 → 企微迁移活动。
 */
import { DataTypes, Model } from 'sequelize';

export class MigrationCampaign extends Model {
  static initModel(sequelize) {
    MigrationCampaign.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        channel_live_code_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        welcome_msg: { type: DataTypes.TEXT, allowNull: true },
        script_template: { type: DataTypes.TEXT, allowNull: true },
        target_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        migrated_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        status: {
          type: DataTypes.ENUM('draft', 'active', 'ended'),
          allowNull: false,
          defaultValue: 'draft',
        },
        starts_at: { type: DataTypes.DATE, allowNull: true },
        ends_at: { type: DataTypes.DATE, allowNull: true },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      },
      {
        sequelize,
        modelName: 'MigrationCampaign',
        tableName: 'migration_campaigns',
        underscored: true,
        timestamps: true,
      },
    );
    return MigrationCampaign;
  }
}
