import { DataTypes, Model } from 'sequelize';

export class KbCategory extends Model {
  static initModel(sequelize) {
    KbCategory.init({
      id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id:     { type: DataTypes.INTEGER, allowNull: false },
      name:          { type: DataTypes.STRING(100), allowNull: false },
      slug:          { type: DataTypes.STRING(100) },
      description:   { type: DataTypes.STRING(500) },
      icon:          { type: DataTypes.STRING(50) },
      sort_order:    { type: DataTypes.INTEGER, defaultValue: 0 },
      is_published:  { type: DataTypes.BOOLEAN, defaultValue: false },
      created_by:    { type: DataTypes.INTEGER },
      created_at:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updated_at:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW, onUpdate: DataTypes.NOW },
    }, { sequelize, tableName: 'kb_categories', timestamps: true, underscored: true });
    return KbCategory;
  }
  static associate(models) {
    KbCategory.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    KbCategory.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    KbCategory.hasMany(models.KbArticle, { foreignKey: 'category_id', as: 'articles' });
  }
}

