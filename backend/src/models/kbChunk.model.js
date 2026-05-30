/**
 * @file 知识库分块。
 */
import { DataTypes, Model } from 'sequelize';

export class KbChunk extends Model {
  static initModel(sequelize) {
    KbChunk.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        document_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        chunk_index: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        content: { type: DataTypes.TEXT, allowNull: false },
        embedding_json: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: 'KbChunk',
        tableName: 'kb_chunks',
        underscored: true,
        updatedAt: false,
      },
    );
    return KbChunk;
  }
}
