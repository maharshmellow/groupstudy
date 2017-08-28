#!/usr/bin/env python
from threading import Lock
from flask import Flask, render_template, session, request
from flask_socketio import SocketIO, emit, join_room, leave_room, \
    close_room, rooms, disconnect
import random
import string
import os

async_mode = None
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY")
socketio = SocketIO(app, async_mode=async_mode)
thread = None
thread_lock = Lock()

def pinging_thread():
    # pinging all the connections every 25 seconds to keep heroku connection alive
    while True:
        socketio.sleep(25)
        socketio.emit('response', {'data': 'ping'}, namespace='/process')


@app.route('/')
def index():
    room_number = ''.join(random.SystemRandom().choice(string.ascii_letters + string.digits) for i in range(10))
    session["room_number"] = room_number
    return render_template('index.html', invite_url=session["room_number"], async_mode=socketio.async_mode)


@app.route('/r/<room>')
def add_user(room):
    # Called when the user already has an invite link
    session["room_number"] = room
    return render_template('index.html', invite_url=session["room_number"], async_mode=socketio.async_mode)


@socketio.on('connect', namespace='/process')
def connect():
    # Starts the pinging thread to keep the heroku session alive
    global thread
    with thread_lock:
        if thread is None:
            thread = socketio.start_background_task(target=pinging_thread)

    # start the socket connection and join the room
    print("Connected: ", session["room_number"], " ID:", request.sid)
    socketio.sleep(1)           # without sleeping it sometims causes a deviation in the times between users in the same group
    emit('sync_time_request', room=session["room_number"])
    join_room(session["room_number"])
    emit('response',{'data': "connect", "room":session["room_number"]}, room=session['room_number'])


@socketio.on('disconnect', namespace='/process')
def disconnect():
    leave_room(session["room_number"])
    print("Disconnected: ", session["room_number"], " ID:", request.sid)
    emit('response', {"data":"disconnect"}, room=session["room_number"])


@socketio.on('sync_time_event', namespace='/process')
def sync_time_event(message):
    # Called when an action is done that would need a sync of time between all group members
    emit('sync_time_response', {'time': message['time'], 'paused': message["paused"], 'session': message["session"], "type":message["type"], "count":message["count"]}, room=session['room_number'] )


@socketio.on('playtoggle_event', namespace='/process')
def playtoggle_event(message):
    # Called when a user presses the pause/play button
    emit('playtoggle_response', {"pause":message["pause"]}, room=session["room_number"])

if __name__ == '__main__':
    socketio.run(app)
