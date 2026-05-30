/**
 * @file 落地页访问追踪（UTM）模型。
 */
import { DataTypes, Model } from 'sequelize';

export class PageVisit extends Model {
  static initModel(sequelize) {
    PageVisit.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        session_id: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        utm_source: { type: DataTypes.STRING(100), allowNull: true },
        utm_medium: { type: DataTypes.STRING(100), allowNull: true },
        utm_campaign: { type: DataTypes.STRING(100), allowNull: true },
        utm_content: { type: DataTypes.STRING(100), allowNull: true },
        utm_term: { type: DataTypes.STRING(100), allowNull: true },
        referrer: { type: DataTypes.STRING(500), allowNull: true },
        landing_path: { type: DataTypes.STRING(255), allowNull: true },
        ip: { type: DataTypes.STRING(45), allowNull: true },
        user_agent: { type: DataTypes.STRING(512), allowNull: true },
        attributed_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'PageVisit',
        tableName: 'page_visits',
        underscored: true,
        updatedAt: false,
      },
    );
    return PageVisit;
  }
}
