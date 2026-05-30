/**
 * @file 员工用户模型（登录账号在企业内唯一）。
 */
import { DataTypes, Model } from 'sequelize';

export class User extends Model {
  static initModel(sequelize) {
    User.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        username: { type: DataTypes.STRING(50), allowNull: false },
        password_hash: { type: DataTypes.STRING(255), allowNull: false },
        real_name: { type: DataTypes.STRING(50), allowNull: true },
        phone: { type: DataTypes.STRING(20), allowNull: true },
        email: { type: DataTypes.STRING(100), allowNull: true },
        avatar_url: { type: DataTypes.STRING(255), allowNull: true },
        wework_userid: { type: DataTypes.STRING(64), allowNull: true },
        /** 与企微扫码登录返回的 corpid 一致，可与租户级配置并存 */
        wework_corp_id: { type: DataTypes.STRING(64), allowNull: true },
        role_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        demo_mode: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        /** 过渡：与 roles 表配套的简短编码 admin/sales（见 database/036–037） */
        role: { type: DataTypes.STRING(32), allowNull: true },
        department: { type: DataTypes.STRING(50), allowNull: true },
        status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        last_login_at: { type: DataTypes.DATE, allowNull: true },
      },
      { sequelize, modelName: 'User', tableName: 'users' }
    );
    return User;
  }
}
