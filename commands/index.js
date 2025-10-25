// Slash command definitions for the Discord bot

const commands = [
  {
    name: 'help',
    description: 'Show bot help and commands'
  },
  {
    name: 'createdropdown',
    description: 'Admin only - Create role dropdown',
    options: [{
      name: 'category',
      type: 3,
      description: 'Category title',
      required: true
    },
    {
      name: 'options',
      type: 3,
      description: 'Comma-separated labels',
      required: true
    },
    {
      name: 'roleids',
      type: 3,
      description: 'Comma-separated role IDs',
      required: true
    },
    {
      name: 'description',
      type: 3,
      description: 'Embed description',
      required: false
    }]
  },
  {
    name: 'listdropdowns',
    description: 'Admin only - List dropdowns'
  },
  {
    name: 'deletedropdown',
    description: 'Admin only - Delete dropdown',
    options: [{
      name: 'id',
      type: 3,
      description: 'Dropdown ID',
      required: true
    }]
  },

  // Schedule config commands
  {
    name: 'schedule_addprofessor',
    description: 'Add professor',
    options: [{
      name: 'name',
      type: 3,
      description: 'Professor name',
      required: true
    }]
  },
  {
    name: 'schedule_addlocation',
    description: 'Add location',
    options: [{
      name: 'name',
      type: 3,
      description: 'Location name',
      required: true
    }]
  },
  {
    name: 'schedule_addclassname',
    description: 'Add class name',
    options: [{
      name: 'name',
      type: 3,
      description: 'Class name',
      required: true
    }]
  },
  {
    name: 'schedule_adddate',
    description: 'Add date',
    options: [{
      name: 'date',
      type: 3,
      description: 'Date (YYYY-MM-DD)',
      required: true
    }]
  },
  {
    name: 'schedule_addtime',
    description: 'Add time',
    options: [{
      name: 'time',
      type: 3,
      description: 'Time (HH:MM)',
      required: true
    }]
  },
  {
    name: 'schedule_addchannel',
    description: 'Set schedule posting channel',
    options: [{
      name: 'channel',
      type: 7,
      description: 'Choose a channel',
      required: true
    }]
  },
  {
    name: 'schedule_delete',
    description: 'Admin only - Delete a schedule by ID',
    options: [{
      name: 'id',
      type: 3,
      description: 'Schedule ID to delete',
      required: true
    }]
  },
  {
    name: 'schedule_copy',
    description: 'Admin only – Copy an existing schedule',
    options: [{
      name: 'id',
      type: 3,
      description: 'Schedule ID to copy',
      required: true
    }]
  },
  {
    name: 'schedule_menu',
    description: 'Admin only - Open schedule builder menu'
  },
  {
    name: 'schedule_list',
    description: 'Admin only - List saved schedules'
  },
  {
    name: 'schedule_edit',
    description: 'Admin only - Edit schedule field',
    options: [{
      name: 'id',
      type: 3,
      description: 'Schedule ID',
      required: true
    },
    {
      name: 'field',
      type: 3,
      description: 'Field to edit',
      required: true
    },
    {
      name: 'value',
      type: 3,
      description: 'New value',
      required: true
    }]
  },
  
  // Homework commands
  {
    name: 'homework_menu',
    description: 'Admin only - Open homework builder menu'
  },
  {
    name: 'homework_list',
    description: 'Admin only - List saved homework assignments'
  },
  {
    name: 'homework_edit',
    description: 'Admin only - Edit homework field',
    options: [{
      name: 'id',
      type: 3,
      description: 'Homework ID',
      required: true
    },
    {
      name: 'field',
      type: 3,
      description: 'Field to edit',
      required: true
    },
    {
      name: 'value',
      type: 3,
      description: 'New value',
      required: true
    }]
  },
  {
    name: 'homework_delete',
    description: 'Admin only - Delete a homework by ID',
    options: [{
      name: 'id',
      type: 3,
      description: 'Homework ID to delete',
      required: true
    }]
  },
  {
    name: 'homework_copy',
    description: 'Admin only - Copy an existing homework',
    options: [{
      name: 'id',
      type: 3,
      description: 'Homework ID to copy',
      required: true
    }]
  },
  {
    name: 'homework_addchannel',
    description: 'Set homework posting channel',
    options: [{
      name: 'channel',
      type: 7,
      description: 'Choose a channel',
      required: true
    }]
  }
];

module.exports = commands;
