/**
 * @file 知识库文档（RAG 源）。
 */
import { DataTypes, Model } from 'sequelize';

export class KbDocument extends Model {
  static initModel(sequelize) {
    KbDocument.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        title: { type: DataTypes.STRING(200), allowNull: false },
        category: { type: DataTypes.STRING(64), allowNull: true },
        content_text: { type: DataTypes.TEXT('medium'), allowNull: false },
        status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'KbDocument',
        tableName: 'kb_documents',
        underscored: true,
      },
    );
    return KbDocument;
  }
}
