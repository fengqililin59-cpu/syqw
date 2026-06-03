/**
 * @file 平台运营对租户的回访备注。
 */
import { DataTypes, Model } from 'sequelize';

export class TenantPlatformOpsNote extends Model {
  static initModel(sequelize) {
    TenantPlatformOpsNote.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        author_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        note_type: {
          type: DataTypes.ENUM('call', 'wechat', 'email', 'other'),
          allowNull: false,
          defaultValue: 'call',
        },
        content: { type: DataTypes.TEXT, allowNull: false },
        next_follow_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
      },
      {
        sequelize,
        modelName: 'TenantPlatformOpsNote',
        tableName: 'tenant_platform_ops_notes',
        underscored: true,
        updatedAt: false,
        createdAt: 'created_at',
      },
    );
    return TenantPlatformOpsNote;
  }
}
