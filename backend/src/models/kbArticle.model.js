import { DataTypes, Model } from 'sequelize';

export class KbArticle extends Model {
  static initModel(sequelize) {
    KbArticle.init({
      id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id:        { type: DataTypes.INTEGER, allowNull: false },
      category_id:      { type: DataTypes.INTEGER },
      title:            { type: DataTypes.STRING(200), allowNull: false },
      slug:             { type: DataTypes.STRING(200) },
      summary:          { type: DataTypes.STRING(500) },
      content:          { type: DataTypes.TEXT },
      content_type:     { type: DataTypes.ENUM('markdown', 'html', 'text'), defaultValue: 'markdown' },
      tags:             { type: DataTypes.JSON, defaultValue: [] },
      author_id:        { type: DataTypes.INTEGER },
      status:           { type: DataTypes.ENUM('draft', 'published', 'archived'), defaultValue: 'draft' },
      is_featured:     { type: DataTypes.BOOLEAN, defaultValue: false },
      is_ai_generated: { type: DataTypes.BOOLEAN, defaultValue: false },
      view_count:       { type: DataTypes.INTEGER, defaultValue: 0 },
      helpful_yes:      { type: DataTypes.INTEGER, defaultValue: 0 },
      helpful_no:       { type: DataTypes.INTEGER, defaultValue: 0 },
      sort_order:       { type: DataTypes.INTEGER, defaultValue: 0 },
      published_at:     { type: DataTypes.DATE },
      created_at:       { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updated_at:       { type: DataTypes.DATE, defaultValue: DataTypes.NOW, onUpdate: DataTypes.NOW },
    }, { sequelize, tableName: 'kb_articles', timestamps: true, underscored: true });
    return KbArticle;
  }

  static associate(models) {
    KbArticle.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    KbArticle.belongsTo(models.KbCategory, { foreignKey: 'category_id', as: 'category' });
    KbArticle.belongsTo(models.User, { foreignKey: 'author_id', as: 'author' });
  }
}

