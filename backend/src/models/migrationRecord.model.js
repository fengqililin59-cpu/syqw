/**
 * @file 迁移活动下的个人微信客户记录。
 */
import { DataTypes, Model } from 'sequelize';

export class MigrationRecord extends Model {
  static initModel(sequelize) {
    MigrationRecord.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        campaign_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        wx_nickname: { type: DataTypes.STRING(50), allowNull: true },
        wx_phone: { type: DataTypes.STRING(20), allowNull: true },
        wx_remark: { type: DataTypes.STRING(100), allowNull: true },
        owner_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        status: {
          type: DataTypes.ENUM('pending', 'contacted', 'migrated', 'lost'),
          allowNull: false,
          defaultValue: 'pending',
        },
        contacted_at: { type: DataTypes.DATE, allowNull: true },
        migrated_at: { type: DataTypes.DATE, allowNull: true },
        external_userid: { type: DataTypes.STRING(64), allowNull: true },
        note: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        modelName: 'MigrationRecord',
        tableName: 'migration_records',
        underscored: true,
        timestamps: true,
      },
    );
    return MigrationRecord;
  }
}
