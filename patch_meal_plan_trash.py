import re

with open('app/admin/meal-plan-structure/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove Sub-Service
content = content.replace(
    '<Button\n                                            variant="ghost"\n                                            size="sm"\n                                            onClick={(e) => {\n                                              e.stopPropagation()\n                                              handleRemoveSubService(day, svc.serviceId, subSvc.subServiceId)\n                                            }}\n                                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"\n                                            title="Remove Sub-Service"\n                                          >\n                                            <Trash2 className="w-4 h-4" />\n                                          </Button>',
    '{isSuperAdmin && <Button\n                                            variant="ghost"\n                                            size="sm"\n                                            onClick={(e) => {\n                                              e.stopPropagation()\n                                              handleRemoveSubService(day, svc.serviceId, subSvc.subServiceId)\n                                            }}\n                                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"\n                                            title="Remove Sub-Service"\n                                          >\n                                            <Trash2 className="w-4 h-4" />\n                                          </Button>}'
)

# Remove Service
content = content.replace(
    '<button\n                                        onClick={(e) => {\n                                          e.stopPropagation()\n                                          handleRemoveService(day, svc.serviceId)\n                                        }}\n                                        className="p-1.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"\n                                        title="Remove Service"\n                                      >\n                                        <Trash2 className="h-3 w-3 text-red-500" />\n                                      </button>',
    '{isSuperAdmin && <button\n                                        onClick={(e) => {\n                                          e.stopPropagation()\n                                          handleRemoveService(day, svc.serviceId)\n                                        }}\n                                        className="p-1.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"\n                                        title="Remove Service"\n                                      >\n                                        <Trash2 className="h-3 w-3 text-red-500" />\n                                      </button>}'
)

# Delete Choice Button
content = content.replace(
    '<button onClick={() => handleDeleteChoice(day, svc.serviceId, subSvc.subServiceId, choice.choiceId)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Delete Choice"><Trash2 className="w-3 h-3"/></button>',
    '{isSuperAdmin && <button onClick={() => handleDeleteChoice(day, svc.serviceId, subSvc.subServiceId, choice.choiceId)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Delete Choice"><Trash2 className="w-3 h-3"/></button>}'
)

# Delete Assignment 
content = content.replace(
    '<Button\n                        variant="ghost"\n                        size="sm"\n                        onClick={() => handleDeleteAssignment(mpIndex, smpIndex)}\n                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 ml-2"\n                      >\n                        <Trash2 className="h-3 w-3" />\n                      </Button>',
    '{isSuperAdmin && <Button\n                        variant="ghost"\n                        size="sm"\n                        onClick={() => handleDeleteAssignment(mpIndex, smpIndex)}\n                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 ml-2"\n                      >\n                        <Trash2 className="h-3 w-3" />\n                      </Button>}'
)

content = content.replace(
    '<Button\n                    variant="ghost"\n                    size="sm"\n                    onClick={() => handleDeleteChoice(choice.id)}\n                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"\n                  >\n                    <Trash2 className="h-3 w-3" />\n                  </Button>',
    '{isSuperAdmin && <Button\n                    variant="ghost"\n                    size="sm"\n                    onClick={() => handleDeleteChoice(choice.id)}\n                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"\n                  >\n                    <Trash2 className="h-3 w-3" />\n                  </Button>}'
)


with open('app/admin/meal-plan-structure/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Trash patch successful!")
