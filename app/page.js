"use client"
import React from 'react'

const page = () => {
  return (
    <div className='w-full h-screen flex flex-col justify-center items-center'>
      <h1 className='text-4xl font-bold'>Invite & Connect</h1>
      <div className="mt-10 flex flex-col gap-5 justify-center border border-blue-500 items-center rounded-2xl  bg-gray-900 px-10 py-8">
        <p className="text-gray-300 text-lg">Authenticate to access dashboard</p>
        <div className='flex gap-5'>
        <button onClick={() => window.location.href = '/login'} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300">Login</button>
        <button onClick={() => window.location.href = '/signup'} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition duration-300">Sign Up</button>
        </div>
      </div>
    </div>
  )
}

export default page