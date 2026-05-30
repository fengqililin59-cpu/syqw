/**
 * @file 角色模型（权限 JSON 存于 permissions 字段）。
 */
import { DataTypes, Model } from 'sequelize';

export class Role extends Model {
  static initModel(sequelize) {
    Role.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(50), allowNull: false },
        is_system: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
        perm_codes: { type: DataTypes.JSON, allowNull: true },
        permissions: { type: DataTypes.JSON, allowNull: true },
        description: { type: DataTypes.STRING(255), allowNull: true },
      },
      { sequelize, modelName: 'Role', tableName: 'roles' }
    );
    return Role;
  }
}
