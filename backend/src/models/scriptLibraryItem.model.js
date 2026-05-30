/**
 * @file 话术库条目模型。
 */
import { DataTypes, Model } from 'sequelize';

export class ScriptLibraryItem extends Model {
  static initModel(sequelize) {
    ScriptLibraryItem.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        category: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'general' },
        title: { type: DataTypes.STRING(200), allowNull: false },
        body: { type: DataTypes.TEXT, allowNull: false },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'ScriptLibraryItem',
        tableName: 'script_library_items',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return ScriptLibraryItem;
  }
}
