/**
 * @file 客户批量导入任务。
 */
import { DataTypes, Model } from 'sequelize';

export class ImportJob extends Model {
  static initModel(sequelize) {
    ImportJob.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        file_name: { type: DataTypes.STRING(255), allowNull: false },
        total_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        imported_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        updated_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        skipped_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        failed_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        status: {
          type: DataTypes.ENUM('parsing', 'previewing', 'importing', 'done', 'failed'),
          allowNull: false,
          defaultValue: 'parsing',
        },
        preview_json: { type: DataTypes.JSON, allowNull: true },
        result_json: { type: DataTypes.JSON, allowNull: true },
        error_msg: { type: DataTypes.STRING(500), allowNull: true },
      },
      {
        sequelize,
        modelName: 'ImportJob',
        tableName: 'import_jobs',
        underscored: true,
        timestamps: true,
      },
    );
    return ImportJob;
  }
}
