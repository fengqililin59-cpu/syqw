/**
 * @file 群 SOP 目标关联模型。
 */
import { DataTypes, Model } from 'sequelize';

export class GroupSopTarget extends Model {
  static initModel(sequelize) {
    GroupSopTarget.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        sop_task_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        group_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        last_sent_at: { type: DataTypes.DATE, allowNull: true },
        send_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: 'GroupSopTarget',
        tableName: 'group_sop_targets',
        underscored: true,
        timestamps: false,
      },
    );
    return GroupSopTarget;
  }
}
