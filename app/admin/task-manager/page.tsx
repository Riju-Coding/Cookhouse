"use client"

import React, { useState, useEffect } from "react"
import { taskManagerService, type SystemTask, type DevTaskStatus } from "@/lib/firestore/taskManagerService"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Code, Plus, CheckCircle2, Circle, Clock, ArrowRightCircle, MessageSquare, Star, Trash2, Download } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { format } from "date-fns"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import * as XLSX from "xlsx"

const STATUSES: DevTaskStatus[] = ['To Do', 'In Progress', 'Review', 'Done']

export default function TaskManager() {
  const [tasks, setTasks] = useState<SystemTask[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // New Task State
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [assigneeName, setAssigneeName] = useState("")
  const [priority, setPriority] = useState<any>("Medium")

  const { userProfile } = useAuth()

  // Detail Modal State
  const [selectedTask, setSelectedTask] = useState<SystemTask | null>(null)
  const [reviewText, setReviewText] = useState("")
  const [reviewRating, setReviewRating] = useState("5")
  const [reviewType, setReviewType] = useState<"comment" | "review">("comment")

  const fetchTasksAndUsers = async () => {
    setLoading(true)
    try {
      const data = await taskManagerService.getAllTasks()
      setTasks(data)

      const usersSnap = await getDocs(query(collection(db, "users"), where("status", "==", "active")))
      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setUsers(usersData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasksAndUsers()
  }, [])

  const handleCreateTask = async () => {
    if (!assigneeId) return
    try {
      await taskManagerService.createTask({
        title,
        description,
        assigneeId,
        assigneeName,
        creatorId: userProfile?.id || "admin",
        creatorName: userProfile?.name || "Admin",
        priority
      })
      setModalOpen(false)
      setTitle("")
      setDescription("")
      setAssigneeId("")
      setAssigneeName("")
      fetchTasksAndUsers()
    } catch (e) {
      console.error(e)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: DevTaskStatus, oldStatus: DevTaskStatus) => {
    try {
      await taskManagerService.updateTaskStatus(
        taskId, 
        newStatus, 
        oldStatus, 
        userProfile?.id || "unknown", 
        userProfile?.name || "Unknown User"
      )
      fetchTasksAndUsers()
      // If modal is open, update selected task locally
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddReview = async () => {
    if (!selectedTask || !reviewText.trim()) return
    try {
      await taskManagerService.addReviewOrComment(
        selectedTask.id,
        userProfile?.id || "unknown",
        userProfile?.name || "Unknown User",
        reviewText,
        reviewType,
        reviewType === 'review' ? parseInt(reviewRating) : undefined
      )
      setReviewText("")
      fetchTasksAndUsers()
      // Re-fetch selected task for modal
      const updated = await taskManagerService.getAllTasks()
      const t = updated.find(x => x.id === selectedTask.id)
      if (t) setSelectedTask(t)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedTask) return
    try {
      await taskManagerService.deleteTimelineEvent(selectedTask.id, eventId)
      fetchTasksAndUsers()
      // Re-fetch selected task for modal
      const updated = await taskManagerService.getAllTasks()
      const t = updated.find(x => x.id === selectedTask.id)
      if (t) setSelectedTask(t)
    } catch (e) {
      console.error(e)
    }
  }

  const handleExportExcel = () => {
    const exportData: any[] = [];
    
    tasks.forEach(task => {
      // 1. Add the main task row
      exportData.push({
        "Task ID": task.id,
        "Title": task.title,
        "Description": task.description || "",
        "Status": task.status,
        "Severity/Priority": task.priority || "Medium",
        "Assignee": task.assigneeName || "Unassigned",
        "Creator": task.creatorName || "System",
        "Created At": task.createdAt?.toDate ? format(task.createdAt.toDate(), "dd MMM yyyy, HH:mm") : "",
        "Timeline Event": "",
        "Timeline Time": "",
        "Timeline User": "",
        "Timeline Details": ""
      });

      // 2. Add a row for each timeline event underneath it
      if (task.timeline && task.timeline.length > 0) {
        task.timeline.forEach((t, index) => {
          const date = t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd MMM yyyy, HH:mm") : "Unknown Date";
          const actor = t.userName || "System";
          let eventAction = "Performed action";
          let details = "";
          
          if (t.type === 'status_change') {
            eventAction = "🔄 Status Change";
            details = `${t.oldStatus || 'unknown'} ➔ ${t.newStatus || 'unknown'}`;
          } else if (t.type === 'review') {
            const stars = t.rating ? `(${t.rating} ⭐)` : '';
            eventAction = `📝 Manager Review ${stars}`;
            details = `"${t.text || 'No comment'}"`;
          } else if (t.type === 'comment') {
            eventAction = "💬 Comment";
            details = `"${t.text || 'No text'}"`;
          }

          exportData.push({
            "Task ID": "", 
            "Title": `   ↳ Step ${index + 1}`, // Visual indentation for child row
            "Description": "",
            "Status": "",
            "Severity/Priority": "",
            "Assignee": "",
            "Creator": "",
            "Created At": "",
            "Timeline Event": eventAction,
            "Timeline Time": date,
            "Timeline User": actor,
            "Timeline Details": details
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 15 }, // Task ID
      { wch: 30 }, // Title
      { wch: 40 }, // Description
      { wch: 15 }, // Status
      { wch: 15 }, // Severity/Priority
      { wch: 20 }, // Assignee
      { wch: 20 }, // Creator
      { wch: 20 }, // Created At
      { wch: 25 }, // Timeline Event
      { wch: 20 }, // Timeline Time
      { wch: 20 }, // Timeline User
      { wch: 50 }  // Timeline Details
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
    XLSX.writeFile(workbook, `Task_Manager_Export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }

  if (loading) return <div className="p-8 text-center">Loading Task Manager...</div>

  return (
    <div className="space-y-6 p-2 lg:p-6 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-indigo-600" /> Task Manager
          </h1>
          <p className="text-gray-600 text-sm mt-0.5">
            Assign and track universal tasks for any employee across the system.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportExcel} variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
            <Download className="w-4 h-4 mr-2" /> Export to Excel
          </Button>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Task Title</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assignee Name</label>
                <Select value={assigneeId} onValueChange={(val) => {
                  setAssigneeId(val)
                  const user = users.find(u => u.id === val)
                  if (user) setAssigneeName(user.name)
                }}>
                  <SelectTrigger><SelectValue placeholder="Select an assignee" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.roleKey})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTask}>Create Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden mb-10">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[11px] uppercase tracking-wider font-semibold text-gray-500 border-b bg-gray-50/80">
          <div className="col-span-2 md:col-span-1">Priority</div>
          <div className="col-span-4 md:col-span-5">Task</div>
          <div className="col-span-3 md:col-span-2">Assignee</div>
          <div className="col-span-3 md:col-span-2">Status</div>
          <div className="hidden md:block col-span-2 text-right">Created</div>
        </div>

        <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
          {[...tasks].sort((a, b) => {
             const priorityWeight: Record<string, number> = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
             const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
             if (pDiff !== 0) return pDiff;
             const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
             const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
             return bTime - aTime;
          }).map(task => {
            const isUntouched = task.timeline?.length <= 1;
            const isExpanded = selectedTask?.id === task.id;

            return (
              <div key={task.id} className="flex flex-col group">
                <div 
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer hover:bg-gray-50 transition-colors relative ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                  onClick={() => setSelectedTask(isExpanded ? null : task)}
                >
                  {/* Left accent bar for priority */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    task.priority === 'Urgent' ? 'bg-red-500' : 
                    task.priority === 'High' ? 'bg-orange-500' : 
                    'bg-transparent'
                  }`} />

                <div className="col-span-2 md:col-span-1 flex items-center">
                  <Badge variant="outline" className={`text-[10px] w-fit ${
                    task.priority === 'Urgent' ? 'text-red-600 border-red-200 bg-red-50' : 
                    task.priority === 'High' ? 'text-orange-600 border-orange-200 bg-orange-50' :
                    'text-gray-600'
                  }`}>
                    {task.priority}
                  </Badge>
                </div>
                <div className="col-span-4 md:col-span-5 flex flex-col pr-4 relative">
                  {isUntouched && (
                    <span className="absolute -top-2 left-0 md:-left-4 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">NEW</span>
                  )}
                  <span className="font-semibold text-sm text-gray-900 truncate">{task.title}</span>
                  <span className="text-xs text-gray-500 truncate">{task.description}</span>
                </div>
                <div className="col-span-3 md:col-span-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {task.assigneeName.charAt(0)}
                  </div>
                  <span className="text-xs text-gray-700 truncate">{task.assigneeName}</span>
                </div>
                <div className="col-span-3 md:col-span-2 flex items-center">
                   <Badge className={`text-[10px] w-fit ${
                     task.status === 'Done' ? 'bg-green-500 hover:bg-green-600' : 
                     task.status === 'Review' ? 'bg-amber-500 hover:bg-amber-600' : 
                     task.status === 'In Progress' ? 'bg-blue-500 hover:bg-blue-600' : 
                     'bg-gray-500 hover:bg-gray-600'
                   }`}>
                     {task.status}
                   </Badge>
                </div>
                <div className="hidden md:block col-span-2 text-right text-xs text-gray-400">
                  {task.createdAt?.toDate ? format(task.createdAt.toDate(), "MMM d, yyyy") : "—"}
                </div>
                </div>

                {/* EXPANDED TIMELINE CONTENT */}
                {isExpanded && (
                  <div className="bg-gray-50/50 p-6 shadow-inner border-t">
                  <div className="flex items-center justify-between mb-4 border-b pb-4">
                    <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                    <Select 
                      value={task.status} 
                      onValueChange={(val: DevTaskStatus) => handleStatusChange(task.id, val, task.status)}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-6">{task.description}</p>
                  
                  <div className="flex gap-6 text-sm text-gray-600 border-y py-3 bg-gray-50/50 px-4 rounded-md mb-6">
                    <div><span className="font-semibold block text-xs text-gray-400">Assignee</span> {task.assigneeName}</div>
                    <div><span className="font-semibold block text-xs text-gray-400">Created By</span> {task.creatorName}</div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" /> Activity Timeline
                    </h4>
                    <div className="space-y-4 pl-3 border-l-2 border-indigo-100 ml-2">
                      {task.timeline?.map(event => (
                        <div key={event.id} className="relative pl-6">
                          <div className="absolute -left-[27px] bg-white p-1.5 rounded-full border border-indigo-100 shadow-sm">
                            {event.type === 'status_change' ? <ArrowRightCircle className="w-3 h-3 text-blue-500" /> : 
                             event.type === 'review' ? <Star className="w-3 h-3 text-amber-500" /> :
                             <MessageSquare className="w-3 h-3 text-gray-500" />}
                          </div>
                          <div className="bg-gray-50 border rounded-lg p-3 text-sm hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-semibold text-gray-800">{event.userName}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400">{event.createdAt?.toDate ? format(event.createdAt.toDate(), "MMM d, h:mm a") : "—"}</span>
                                {userProfile?.userType === 'super_admin' && event.type !== 'status_change' && (
                                  <button onClick={() => handleDeleteEvent(event.id)} className="text-red-400 hover:text-red-600 bg-red-50 p-1 rounded">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {event.type === 'status_change' && (
                              <p className="text-gray-600 mt-1">Moved task from <Badge variant="outline" className="text-[10px] mx-1">{event.oldStatus}</Badge> to <Badge className="text-[10px] ml-1">{event.newStatus}</Badge></p>
                            )}
                            
                            {event.type === 'review' && (
                              <div className="mt-2 bg-amber-50 border border-amber-100 p-2 rounded">
                                <div className="flex items-center gap-1 mb-1 text-amber-500">
                                  {Array.from({length: event.rating || 5}).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                                  <span className="text-xs text-amber-700 ml-2 font-semibold">Manager Review</span>
                                </div>
                                <p className="text-gray-800 font-medium">{event.text}</p>
                              </div>
                            )}

                            {event.type === 'comment' && (
                              <p className="text-gray-700 mt-1">{event.text}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!task.timeline || task.timeline.length === 0) && (
                        <p className="text-sm text-gray-400 pl-4 italic">No activity recorded yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t space-y-3 bg-gray-50/50 p-4 rounded-xl border">
                    <h4 className="text-sm font-semibold text-gray-700">Add Update</h4>
                    <div className="flex gap-2">
                      <Select value={reviewType} onValueChange={(v: any) => setReviewType(v)}>
                        <SelectTrigger className="w-[130px] bg-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comment">Comment</SelectItem>
                          <SelectItem value="review">Formal Review</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {reviewType === 'review' && (
                        <Select value={reviewRating} onValueChange={setReviewRating}>
                          <SelectTrigger className="w-[100px] bg-white text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 Stars</SelectItem>
                            <SelectItem value="4">4 Stars</SelectItem>
                            <SelectItem value="3">3 Stars</SelectItem>
                            <SelectItem value="2">2 Stars</SelectItem>
                            <SelectItem value="1">1 Star</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Input 
                        placeholder={reviewType === 'review' ? "Write your manager review..." : "Add a timeline update..."} 
                        value={reviewText} 
                        onChange={e => setReviewText(e.target.value)} 
                        className="flex-1 bg-white"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddReview()
                        }}
                      />
                      <Button onClick={handleAddReview} disabled={!reviewText.trim()} className="bg-indigo-600 hover:bg-indigo-700">Post Update</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
