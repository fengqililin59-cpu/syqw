/**
 * @file 后台任务队列（P2）。
 */
import { DataTypes, Model } from 'sequelize';

export class BackgroundJob extends Model {
  static initModel(sequelize) {
    BackgroundJob.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        job_type: { type: DataTypes.STRING(64), allowNull: false },
        payload: { type: DataTypes.JSON, allowNull: true },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending' },
        attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        max_attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 5 },
        run_after: { type: DataTypes.DATE, allowNull: true },
        locked_at: { type: DataTypes.DATE, allowNull: true },
        locked_by: { type: DataTypes.STRING(64), allowNull: true },
        last_error: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        modelName: 'BackgroundJob',
        tableName: 'background_jobs',
        underscored: true,
      },
    );
    return BackgroundJob;
  }
}
