/**
 * @file 服务人员排班：weekday 为周期性排班，work_date 为指定日期覆盖（优先级更高）。
 */
import { DataTypes, Model } from 'sequelize';

export class StaffSchedule extends Model {
  static initModel(sequelize) {
    StaffSchedule.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        staff_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        /** 0=周日 … 6=周六；与 work_date 二选一 */
        weekday: { type: DataTypes.TINYINT, allowNull: true },
        work_date: { type: DataTypes.DATEONLY, allowNull: true },
        start_time: { type: DataTypes.TIME, allowNull: false },
        end_time: { type: DataTypes.TIME, allowNull: false },
        is_off: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      },
      {
        sequelize,
        modelName: 'StaffSchedule',
        tableName: 'staff_schedules',
        underscored: true,
      },
    );
    return StaffSchedule;
  }
}
