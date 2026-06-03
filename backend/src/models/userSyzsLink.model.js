/**
 * @file 用户与智学 AI 平台（syzs.top）账号绑定。
 */
import { DataTypes, Model } from 'sequelize';

export class UserSyzsLink extends Model {
  static initModel(sequelize) {
    UserSyzsLink.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        syzs_user_id: { type: DataTypes.STRING(64), allowNull: false },
        syzs_email: { type: DataTypes.STRING(191), allowNull: true },
        syzs_phone: { type: DataTypes.STRING(32), allowNull: true },
      },
      {
        sequelize,
        modelName: 'UserSyzsLink',
        tableName: 'user_syzs_links',
        underscored: true,
        timestamps: true,
        createdAt: 'linked_at',
        updatedAt: 'updated_at',
      },
    );
    return UserSyzsLink;
  }
}
